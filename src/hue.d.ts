declare namespace Hue {
  interface Groups {
    [groupId: string]: Group;
  }

  interface Group {
    /**
     * The light state of one of the lamps in the group.
     */
    action: Action;
    /**
     * The IDs of the lights that are in the group.
     */
    lights: string[];
    /**
     * A unique, editable name given to the group.
     */
    name: string;
    /**
     * If not provided upon creation “LightGroup” is used. Can be “LightGroup”,
     * “Room” or either “Luminaire” or “LightSource” if a Multisource Luminaire
     * is present in the system.
     */
    type: string;

    /**
     * Uniquely identifies the hardware model of the luminaire. Only present for
     * automatically created Luminaires.
     */
    modelid: string;

    /**
     * Unique Id in AA:BB:CC:DD format for Luminaire groups or AA:BB:CC:DD-XX
     * format for Lightsource groups, where XX is the lightsource position.
     */
    uniqueid: string;

    /**
     * Category of Room types. Default is: Other.
     */
    class: string;
  }

  interface Action {
    on: boolean;
    bri: number;
    hue: number;
    sat: number;
    effect: "none" | "colorloop";
    colormode: string;
    alert: string;
    ct: number;
    xy: [number, number];
  }

  interface Scenes {
    [sceneId: string]: Scene;
  }

  interface Scene {
    /**
     * Human readable name of the scene. Is set to <id> if omitted on creation.
     */
    name: string;

    /**
     * Type of the scene.
     *
     * If not provided on creation a “LightScene” is created.
     */
    type: string;

    /**
     * group ID that a scene is linked to.
     */
    group: string;

    /**
     * The light ids which are in the scene. This array can empty. As of 1.11
     * it must contain at least 1 element. If an invalid lights resource is
     * given, error 7 is returned and the scene is not created.  When writing,
     * lightstate of all lights in list will be overwritten with current light
     * state. As of 1.15 when writing, lightstate of lights which are not yet in
     * list will be created with current light state.
     *
     * The array is informational for GroupScene, it is generated automatically
     * from the lights in the linked group.
     */
    lights: number[];

    /**
     * Whitelist user that created or modified the content of the scene. Note
     * that changing name does not change the owner.
     */
    owner: string;

    /**
     * Indicates whether the scene can be automatically deleted by the bridge.
     * Only available by POSTSet to ‘false’ when omitted. Legacy scenes created
     * by PUT are defaulted to true. When set to ‘false’ the bridge keeps the
     * scene until deleted by an application.
     */
    recycle: boolean;

    /**
     * Indicates that the scene is locked by a rule or a schedule and cannot be
     * deleted until all resources requiring or that reference the scene are
     * deleted.
     */
    locked: boolean;

    /**
     * App specific data linked to the scene.  Each individual application
     * should take responsibility for the data written in this field.
     */
    appdata: Record<string, unknown>;

    /**
     * Only available on a GET of an individual scene resource
     * (/api/<username>/scenes/<id>). Not available for scenes created via a
     * PUT. Reserved for future use.
     */
    picture: string;

    /**
     * 	Unique ID for an image representing the scene. Only available for scenes
     * create from Signify images by Hue application.
     */
    image: string;

    /**
     * UTC time the scene has been created or has been updated by a PUT. Will be
     * null when unknown (legacy scenes).
     */
    lastupdated: string;

    /**
     * Version of scene document:
     * 1 – Scene created via PUT, lightstates will be empty.
     * 2 – Scene created via POST lightstates available.
     */
    version: number;
  }

  interface Lights {
    [lightId: string]: Light;
  }

  interface Light {
    name: string;
    state: Action;
  }
}
