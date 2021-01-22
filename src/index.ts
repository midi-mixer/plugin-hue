// public
import axios from "axios";
import { Assignment } from "midi-mixer-plugin";

const IP = "";
const USERNAME = "";
const api = axios.create({
  baseURL: `http://${IP}/api/${USERNAME}/`,
});

if (!IP) log.warn("No Philips Hue IP given to connect to.");
if (!USERNAME) log.warn("No Philips Hue user given to log in as.");

interface AssignmentData {
  assignment: Assignment;
  scenes: string[];
  currentScene?: number;
}

const assignments: Record<string, AssignmentData> = {};

api
  .get<Hue.Groups>("/groups")
  .then((res) => {
    Object.entries(res.data).forEach(([id, group]) => {
      const assignment = new Assignment(id, {
        name: group.name,
        muted: group.action.on,
        volume: group.action.bri / 254,
        throttle: 1000,
      });

      assignment.on("volumeChanged", (volume: number) => {
        assignment.volume = volume;

        api.put(`/groups/${assignment.id}/action`, {
          bri: Math.round(assignment.volume * 254),
          // on: true,
          transitiontime: 10,
        });
      });

      assignment.on("mutePressed", () => {
        assignment.muted = !assignment.muted;

        api.put(`/groups/${assignment.id}/action`, {
          bri: Math.round(assignment.volume * 254),
          on: assignment.muted,
          transitiontime: 1,
          // effect: "colorloop",
        });
      });

      assignment.on("assignPressed", () => {
        const data = assignments[id];
        if (!data) return;

        data.currentScene =
          ((data.currentScene ?? -1) + 1) % data.scenes.length;
        const sceneId = data.scenes[data.currentScene];
        if (!sceneId) return;

        api
          .put(`/groups/${assignment.id}/action`, {
            on: true,
            scene: sceneId,
            transitiontime: 1,
          })
          .then(() => {
            assignment.muted = true;
          });
      });

      assignments[id] = { assignment, scenes: [] };
    });

    return api.get<Hue.Scenes>(`/scenes`);
  })
  .then((res) => {
    Object.entries(res.data).forEach(([id, scene]) => {
      const assignment = assignments[scene.group];
      if (!assignment) return;

      assignment.scenes.push(id);
    });
  });
