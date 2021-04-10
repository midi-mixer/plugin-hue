// public
import axios, { AxiosInstance } from "axios";
import { Assignment } from "midi-mixer-plugin";

interface Assignments {
  groups: Record<string, AssignmentData>;
  lights: Record<string, Assignment>;
}

interface AssignmentData {
  assignment: Assignment;
  scenes: string[];
  currentScene?: number;
}

export class HueSyncApi {
  private readonly assignments: Assignments = {
    groups: {},
    lights: {},
  };
  private syncingLights: Promise<void> | null = null;
  private syncingGroups: Promise<void> | null = null;
  private needResync = false;
  private changeSyncTimer: ReturnType<typeof setInterval> | null = null;

  private readonly settings = $MM.getSettings();

  private readonly api = new Promise<AxiosInstance>((resolve, reject) => {
    this.settings
      .then((settings) => {
        if (!settings?.hueip)
          return reject(new Error("No Philips Hue IP given to connect to."));

        if (!settings?.hueuser)
          return reject(new Error("No Philips Hue user given to log in as."));

        const instance = axios.create({
          baseURL: `http://${settings.hueip}/api/${settings.hueuser}`,
        });

        resolve(instance);
      })
      .catch(reject);
  });

  constructor() {
    this.syncGroups();
    this.syncLights();

    this.settings.then((settings) => {
      const attemptedInterval = Math.ceil(Number(settings.synctime || 30));

      const interval =
        isFinite(attemptedInterval) && attemptedInterval
          ? attemptedInterval * 1000
          : 30000;

      console.log("Sync interval:", interval / 1000, "seconds");

      setInterval(() => this.syncGroups(), interval);
      setInterval(() => this.syncLights(), interval);
    });
  }

  public throttleSync(): void {
    this.needResync = true;

    if (!this.changeSyncTimer) {
      this.changeSyncTimer = setInterval(async () => {
        this.needResync = false;
        await Promise.all([this.syncGroups(), this.syncLights()]);

        /**
         * Cancel the interval timer if needResync is still false. If another
         * control has requested a resync then the interval can continue.
         */
        if (!this.needResync && this.changeSyncTimer) {
          clearInterval(this.changeSyncTimer);
          this.changeSyncTimer = null;
        }
      }, 200);
    }
  }

  public async syncLights(): Promise<void> {
    this.syncingLights ??= this._syncLights().then(() => {
      this.syncingLights = null;
    });

    return this.syncingLights;
  }

  public syncGroups(): Promise<void> {
    this.syncingGroups ??= this._syncGroups().then(() => {
      this.syncingGroups = null;
    });

    return this.syncingGroups;
  }

  private async _syncLights(): Promise<void> {
    console.log("Syncing lights");

    const api = await this.api;
    const lightsRes = await api.get<Hue.Lights>("/lights");

    Object.entries(lightsRes.data).forEach(([id, light]) => {
      if (!this.assignments.lights[id]) {
        const assignment = new Assignment(`light-${id}`, {
          name: `${light.name} (light)`,
          muted: light.state.on,
          volume: light.state.bri / 254,
          throttle: 500,
        });

        assignment.on("volumeChanged", (volume: number) => {
          assignment.volume = volume;

          api
            .put(`/lights/${id}/state`, {
              bri: Math.round(assignment.volume * 254),
              // on: true,
              transitiontime: 10,
            })
            .then(() => {
              this.throttleSync();
            });
        });

        assignment.on("mutePressed", () => {
          assignment.muted = !assignment.muted;

          api
            .put(`/lights/${id}/state`, {
              bri: Math.round(assignment.volume * 254),
              on: assignment.muted,
              transitiontime: 1,
              // effect: "colorloop",
            })
            .then(() => {
              this.throttleSync();
            });
        });

        this.assignments.lights[id] = assignment;
      } else {
        const assignment = this.assignments.lights[id];
        assignment.name = `${light.name} (light)`;
        assignment.muted = light.state.on;
        assignment.volume = light.state.bri / 254;
      }
    });
  }

  private async _syncGroups(): Promise<void> {
    console.log("Syncing groups");

    const api = await this.api;

    const [groupsRes, scenesRes] = await Promise.all([
      api.get<Hue.Groups>("/groups"),
      api.get<Hue.Scenes>("/scenes"),
    ]);

    Object.entries(groupsRes.data).forEach(([id, group]) => {
      if (!this.assignments.groups[id]) {
        const assignment = new Assignment(`group-${id}`, {
          name: `${group.name} (room)`,
          muted: group.action.on,
          volume: group.action.bri / 254,
          throttle: 500,
        });

        assignment.on("volumeChanged", (volume: number) => {
          assignment.volume = volume;

          api
            .put(`/groups/${id}/action`, {
              bri: Math.round(assignment.volume * 254),
              // on: true,
              transitiontime: 10,
            })
            .then(() => {
              this.throttleSync();
            });
        });

        assignment.on("mutePressed", () => {
          assignment.muted = !assignment.muted;

          api
            .put(`/groups/${id}/action`, {
              bri: Math.round(assignment.volume * 254),
              on: assignment.muted,
              transitiontime: 1,
            })
            .then(() => {
              this.throttleSync();
            });
        });

        assignment.on("assignPressed", () => {
          const data = this.assignments.groups[id];
          if (!data) return;

          data.currentScene =
            ((data.currentScene ?? -1) + 1) % data.scenes.length;
          const sceneId = data.scenes[data.currentScene];
          if (!sceneId) return;

          api
            .put(`/groups/${id}/action`, {
              on: true,
              scene: sceneId,
              transitiontime: 1,
              effect: sceneId === "colorloop" ? "colorloop" : "none",
            })
            .then(() => {
              assignment.muted = true;
              this.throttleSync();
            });
        });

        this.assignments.groups[id] = { assignment, scenes: ["colorloop"] };
      } else {
        const { assignment } = this.assignments.groups[id];
        assignment.name = `${group.name} (room)`;
        assignment.muted = group.action.on;
        assignment.volume = group.action.bri / 254;
        this.assignments.groups[id].scenes = ["colorloop"];
      }
    });

    Object.entries(scenesRes.data).forEach(([id, scene]) => {
      const assignment = this.assignments.groups[scene.group];
      if (!assignment) return;
      assignment.scenes.push(id);
    });
  }
}
