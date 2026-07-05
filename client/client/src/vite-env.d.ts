/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WS_URL: string;

  readonly VITE_CHARACTER_MODEL_PATH: string;
  readonly VITE_COIN_MODEL_PATH: string;
  readonly VITE_PLATE_FOLDER: string;

  readonly VITE_CHARACTER_HEIGHT: string;
  readonly VITE_COIN_HEIGHT: string;
  readonly VITE_PLATE_MIN_WIDTH: string;
  readonly VITE_PLATE_MAX_WIDTH: string;
  readonly VITE_PLATE_WIDTH_PER_CHAR: string;

  readonly VITE_MOVE_SPEED: string;
  readonly VITE_TURN_SPEED: string;
  readonly VITE_JUMP_VELOCITY: string;
  readonly VITE_GRAVITY: string;
  readonly VITE_SPRINT_MAX_MULT: string;
  readonly VITE_SPRINT_RAMP_TIME: string;
  readonly VITE_SPRINT_DECAY_RATE: string;

  readonly VITE_CAMERA_DISTANCE: string;
  readonly VITE_CAMERA_DISTANCE_MIN: string;
  readonly VITE_CAMERA_DISTANCE_MAX: string;
  readonly VITE_CAMERA_PITCH: string;

  readonly VITE_JOYSTICK_DEADZONE: string;

  readonly VITE_STATUE_ENABLED: string;
  readonly VITE_STATUE_COLOR: string;
  readonly VITE_STATUE_SCALE: string;

  readonly VITE_CREDITS_TEXT: string;
  readonly VITE_CREDITS_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
