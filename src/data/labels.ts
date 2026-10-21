import type {
  Difficulty,
  Equipment,
  EquipmentPreset,
  Experience,
  ExerciseType,
  MovementPattern,
  MuscleGroup,
  TrainingGoal,
  Weekday,
} from '../types';

export const MUSCLES: MuscleGroup[] = [
  'brust',
  'ruecken',
  'schultern',
  'bizeps',
  'trizeps',
  'unterarme',
  'bauch',
  'quadrizeps',
  'beinbeuger',
  'gesaess',
  'waden',
  'ganzkoerper',
];

/** Für den Generator wählbare Muskelgruppen (ohne Ganzkörper) */
export const TRAINABLE_MUSCLES: MuscleGroup[] = MUSCLES.filter((m) => m !== 'ganzkoerper');

export const MUSCLE_LABEL: Record<MuscleGroup, string> = {
  brust: 'Brust',
  ruecken: 'Rücken',
  schultern: 'Schultern',
  bizeps: 'Bizeps',
  trizeps: 'Trizeps',
  unterarme: 'Unterarme',
  bauch: 'Bauch',
  quadrizeps: 'Quadrizeps',
  beinbeuger: 'Beinbeuger',
  gesaess: 'Gesäß',
  waden: 'Waden',
  ganzkoerper: 'Ganzkörper',
};

export const MUSCLE_REGION: Record<MuscleGroup, 'push' | 'pull' | 'legs' | 'core' | 'full'> = {
  brust: 'push',
  schultern: 'push',
  trizeps: 'push',
  ruecken: 'pull',
  bizeps: 'pull',
  unterarme: 'pull',
  quadrizeps: 'legs',
  beinbeuger: 'legs',
  gesaess: 'legs',
  waden: 'legs',
  bauch: 'core',
  ganzkoerper: 'full',
};

/** Repräsentatives Foto je Muskelgruppe (Übungs-ID) */
export const MUSCLE_COVER: Record<MuscleGroup, string> = {
  brust: 'Dumbbell_Bench_Press',
  ruecken: 'Wide-Grip_Lat_Pulldown',
  schultern: 'Side_Lateral_Raise',
  bizeps: 'Barbell_Curl',
  trizeps: 'Triceps_Pushdown_-_Rope_Attachment',
  unterarme: 'Palms-Up_Barbell_Wrist_Curl_Over_A_Bench',
  bauch: 'Ab_Roller',
  quadrizeps: 'Barbell_Squat',
  beinbeuger: 'Lying_Leg_Curls',
  gesaess: 'Barbell_Hip_Thrust',
  waden: 'Seated_Calf_Raise',
  ganzkoerper: 'Clean_and_Press',
};

export const EQUIPMENT: Equipment[] = [
  'maschine',
  'kabelzug',
  'kurzhantel',
  'langhantel',
  'eigengewicht',
  'multipresse',
  'kettlebell',
  'sonstiges',
];

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  maschine: 'Maschine',
  kabelzug: 'Kabelzug',
  kurzhantel: 'Kurzhanteln',
  langhantel: 'Langhantel',
  eigengewicht: 'Eigengewicht',
  multipresse: 'Multipresse',
  kettlebell: 'Kettlebell',
  sonstiges: 'Sonstige Geräte',
};

export const DIFFICULTIES: Difficulty[] = ['anfaenger', 'fortgeschritten', 'experte'];
export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  anfaenger: 'Anfänger',
  fortgeschritten: 'Fortgeschritten',
  experte: 'Experte',
};

export const EXERCISE_TYPES: ExerciseType[] = ['grunduebung', 'isolation', 'kraft', 'stabilitaet'];
export const TYPE_LABEL: Record<ExerciseType, string> = {
  grunduebung: 'Grundübung',
  isolation: 'Isolationsübung',
  kraft: 'Kraftübung',
  stabilitaet: 'Stabilitätsübung',
};

export const PATTERN_LABEL: Record<MovementPattern, string> = {
  horizontal_push: 'Horizontales Drücken',
  vertical_push: 'Vertikales Drücken',
  horizontal_pull: 'Horizontales Ziehen',
  vertical_pull: 'Vertikales Ziehen',
  chest_fly: 'Fliegende Bewegung',
  lateral_raise: 'Seitheben',
  front_raise: 'Frontheben',
  rear_delt: 'Hintere Schulter',
  shrug: 'Schulterheben',
  elbow_flexion: 'Ellbogenbeugung',
  elbow_extension: 'Ellbogenstreckung',
  wrist: 'Handgelenk',
  carry: 'Tragen',
  squat: 'Kniebeuge',
  lunge: 'Ausfallschritt',
  hinge: 'Hüftbeugung',
  knee_extension: 'Kniestreckung',
  knee_flexion: 'Kniebeugung (Curl)',
  hip_extension: 'Hüftstreckung',
  calf_raise: 'Wadenheben',
  core_flexion: 'Rumpfbeugung',
  core_stability: 'Rumpfstabilität',
  core_rotation: 'Rumpfrotation',
  back_extension: 'Rückenstreckung',
  full_body: 'Ganzkörperbewegung',
};

export const GOAL_LABEL: Record<TrainingGoal, string> = {
  muskelaufbau: 'Muskelaufbau',
  maximalkraft: 'Maximalkraft',
  fitness: 'Allgemeine Fitness',
  grundlagen: 'Wiedereinstieg & Grundlagen',
};

export const EXPERIENCE_LABEL: Record<Experience, string> = {
  anfaenger: 'Anfänger',
  fortgeschritten: 'Fortgeschritten',
  erfahren: 'Erfahren',
};

export const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAY_LABEL: Record<Weekday, string> = {
  0: 'Montag',
  1: 'Dienstag',
  2: 'Mittwoch',
  3: 'Donnerstag',
  4: 'Freitag',
  5: 'Samstag',
  6: 'Sonntag',
};
export const WEEKDAY_SHORT: Record<Weekday, string> = {
  0: 'Mo',
  1: 'Di',
  2: 'Mi',
  3: 'Do',
  4: 'Fr',
  5: 'Sa',
  6: 'So',
};

export const EQUIPMENT_PRESET_LABEL: Record<EquipmentPreset, string> = {
  voll: 'Voll ausgestattetes Studio',
  maschinen: 'Maschinen',
  kabel: 'Kabelzüge',
  freie_gewichte: 'Freie Gewichte',
  kurzhanteln: 'Kurzhanteln',
  langhanteln: 'Langhanteln',
  multipresse: 'Multipresse',
  eigengewicht: 'Eigengewicht',
  individuell: 'Individuelle Auswahl',
};

export const EQUIPMENT_PRESET_MAP: Record<Exclude<EquipmentPreset, 'individuell'>, Equipment[]> = {
  voll: [...EQUIPMENT],
  maschinen: ['maschine', 'eigengewicht'],
  kabel: ['kabelzug', 'eigengewicht'],
  freie_gewichte: ['kurzhantel', 'langhantel', 'kettlebell', 'eigengewicht', 'sonstiges'],
  kurzhanteln: ['kurzhantel', 'eigengewicht'],
  langhanteln: ['langhantel', 'eigengewicht'],
  multipresse: ['multipresse', 'eigengewicht'],
  eigengewicht: ['eigengewicht'],
};
