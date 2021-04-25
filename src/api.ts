// public
import { Assignment } from "midi-mixer-plugin";

interface Assignments {
  groups: Record<string, AssignmentData>;
  lights: Record<string, AssignmentData>;
}

enum ControlTarget {
  Brightness = "brightness",
  Hue = "hue",
}

interface AssignmentData {
  assignment: Assignment;
  scenes?: string[];
  currentScene?: number;
  controlling: ControlTarget;
  brightness?: number;
  hue?: number;
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

  private readonly baseUrl = new Promise<string>((resolve, reject) => {
    this.settings
      .then((settings) => {
        if (!settings?.hueip)
          return reject(new Error("No Philips Hue IP given to connect to."));

        if (!settings?.hueuser)
          return reject(new Error("No Philips Hue user given to log in as."));

        resolve(`http://${settings.hueip}/api/${settings.hueuser}`);
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

    const baseUrl = await this.baseUrl;

    const lightsRes: Hue.Lights = await fetch(`${baseUrl}/lights`).then((res) =>
      res.json()
    );

    Object.entries(lightsRes).forEach(([id, light]) => {
      if (!this.assignments.lights[id]) {
        const assignment = new Assignment(`light-${id}`, {
          name: `${light.name} (light)`,
          assigned: false,
          muted: light.state.on,
          volume: light.state.bri / 254,
          throttle: 100,
        });

        assignment.on("volumeChanged", (volume: number) => {
          assignment.volume = volume;

          const change: any = {
            transitiontime: 1,
          };

          if (this.assignments.lights[id].controlling === ControlTarget.Hue) {
            change.hue = Math.round(assignment.volume * 65535);
            change.sat = 254;
          } else {
            change.bri = Math.round(assignment.volume * 254);
          }

          fetch(`${baseUrl}/lights/${id}/state`, {
            method: "PUT",
            body: JSON.stringify(change),
          }).then((res) => {
            if (res.ok) {
              this.throttleSync();
            }
          });
        });

        assignment.on("runPressed", () => {
          if (!this.assignments.lights[id]) return;

          if (
            this.assignments.lights[id].controlling === ControlTarget.Brightness
          ) {
            assignment.running = true;
            this.assignments.lights[id].controlling = ControlTarget.Hue;
            assignment.volume = (this.assignments.lights[id].hue ?? 0) / 65535;
          } else {
            assignment.running = false;
            this.assignments.lights[id].controlling = ControlTarget.Brightness;
            assignment.volume =
              (this.assignments.lights[id].brightness ?? 0) / 254;
          }
        });

        assignment.on("mutePressed", () => {
          assignment.muted = !assignment.muted;

          fetch(`${baseUrl}/lights/${id}/state`, {
            method: "PUT",
            body: JSON.stringify({
              bri: Math.round(this.assignments.lights[id].brightness ?? 254),
              on: assignment.muted,
              transitiontime: 1,
            }),
          }).then((res) => {
            if (res.ok) {
              this.throttleSync();
            }
          });
        });

        this.assignments.lights[id] = {
          assignment,
          controlling: ControlTarget.Brightness,
          brightness: light.state.bri,
          hue: light.state.hue,
        };
      } else {
        this.assignments.lights[id].brightness = light.state.bri;
        this.assignments.lights[id].hue = light.state.hue;

        const assignment = this.assignments.lights[id].assignment;
        assignment.name = `${light.name} (light)`;
        assignment.muted = light.state.on;
        assignment.running =
          this.assignments.lights[id].controlling === ControlTarget.Hue;
        assignment.volume =
          this.assignments.lights[id].controlling === ControlTarget.Hue
            ? light.state.hue / 65535
            : light.state.bri / 254;
      }
    });
  }

  private async _syncGroups(): Promise<void> {
    console.log("Syncing groups");

    // const api = await this.api;
    const baseUrl = await this.baseUrl;

    const [groupsRes, scenesRes]: [Hue.Groups, Hue.Scenes] = await Promise.all([
      fetch(`${baseUrl}/groups`).then((res) => res.json()),
      fetch(`${baseUrl}/scenes`).then((res) => res.json()),
    ]);

    Object.entries(groupsRes).forEach(([id, group]) => {
      if (!this.assignments.groups[id]) {
        const assignment = new Assignment(`group-${id}`, {
          name: `${group.name} (room)`,
          muted: group.action.on,
          volume: group.action.bri / 254,
          throttle: 1000,
          assigned: true,
        });

        assignment.on("volumeChanged", (volume: number) => {
          assignment.volume = volume;

          const change: any = {
            transitiontime: 10,
          };

          if (this.assignments.groups[id].controlling === ControlTarget.Hue) {
            change.hue = Math.round(assignment.volume * 65535);
            change.sat = 254;
          } else {
            change.bri = Math.round(assignment.volume * 254);
          }

          fetch(`${baseUrl}/groups/${id}/action`, {
            method: "PUT",
            body: JSON.stringify(change),
          }).then((res) => {
            if (res.ok) {
              this.throttleSync();
            }
          });
        });

        assignment.on("runPressed", () => {
          if (!this.assignments.groups[id]) return;

          if (
            this.assignments.groups[id].controlling === ControlTarget.Brightness
          ) {
            assignment.running = true;
            this.assignments.groups[id].controlling = ControlTarget.Hue;
            assignment.volume = (this.assignments.groups[id].hue ?? 0) / 65535;
          } else {
            assignment.running = false;
            this.assignments.groups[id].controlling = ControlTarget.Brightness;
            assignment.volume =
              (this.assignments.groups[id].brightness ?? 0) / 254;
          }
        });

        assignment.on("mutePressed", () => {
          assignment.muted = !assignment.muted;

          fetch(`${baseUrl}/groups/${id}/action`, {
            method: "PUT",
            body: JSON.stringify({
              bri: Math.round(this.assignments.groups[id].brightness ?? 254),
              on: assignment.muted,
              transitiontime: 1,
            }),
          }).then((res) => {
            if (res.ok) {
              this.throttleSync();
            }
          });
        });

        assignment.on("assignPressed", () => {
          const data = this.assignments.groups[id];
          if (!data) return;

          data.currentScene =
            ((data.currentScene ?? -1) + 1) % (data.scenes?.length ?? 0);
          const sceneId = data.scenes?.[data.currentScene];
          if (!sceneId) return;

          fetch(`${baseUrl}/groups/${id}/action`, {
            method: "PUT",
            body: JSON.stringify({
              on: true,
              scene: sceneId,
              transitiontime: 1,
              effect: sceneId === "colorloop" ? "colorloop" : "none",
            }),
          }).then((res) => {
            if (res.ok) {
              this.throttleSync();
            }
          });
        });

        this.assignments.groups[id] = {
          assignment,
          scenes: ["colorloop"],
          controlling: ControlTarget.Brightness,
        };
      } else {
        this.assignments.groups[id].brightness = group.action.bri ?? 254;
        this.assignments.groups[id].hue = group.action.hue ?? 0;

        const { assignment } = this.assignments.groups[id];
        assignment.name = `${group.name} (room)`;
        assignment.muted = group.action.on;
        assignment.volume =
          this.assignments.groups[id].controlling === ControlTarget.Hue
            ? group.action.hue / 65535
            : group.action.bri / 254;
        assignment.running =
          this.assignments.groups[id].controlling === ControlTarget.Hue;
        this.assignments.groups[id].scenes = ["colorloop"];
      }
    });

    Object.entries(scenesRes).forEach(([id, scene]) => {
      const assignment = this.assignments.groups[scene.group];
      if (!assignment) return;
      assignment.scenes?.push(id);
    });
  }
}
