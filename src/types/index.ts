// ---------- Stammdaten ----------

export type MuscleGroup =
  | 'brust'
  | 'ruecken'
  | 'schultern'
  | 'bizeps'
  | 'trizeps'
  | 'unterarme'
  | 'bauch'
  | 'quadrizeps'
  | 'beinbeuger'
  | 'gesaess'
  | 'waden'
  | 'ganzkoerper';

export type Equipment =
  | 'maschine'
  | 'kabelzug'
  | 'kurzhantel'
  | 'langhantel'
  | 'eigengewicht'
  | 'multipresse'
  | 'kettlebell'
  | 'sonstiges';

export type Difficulty = 'anfaenger' | 'fortgeschritten' | 'experte';

export type ExerciseType = 'grunduebung' | 'isolation' | 'kraft' | 'stabilitaet';

/** Bewegungsmuster – Grundlage für Generator-Reihenfolge und Alternativen-Finder */
export type MovementPattern =
  | 'horizontal_push'
  | 'vertical_push'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'chest_fly'
  | 'lateral_raise'
  | 'front_raise'
  | 'rear_delt'
  | 'shrug'
  | 'elbow_flexion'
  | 'elbow_extension'
  | 'wrist'
  | 'carry'
  | 'squat'
  | 'lunge'
  | 'hinge'
  | 'knee_extension'
  | 'knee_flexion'
  | 'hip_extension'
  | 'calf_raise'
  | 'core_flexion'
  | 'core_stability'
  | 'core_rotation'
  | 'back_extension'
  | 'full_body';

export interface RepRange {
  sets: number;
  repsMin: number;
  repsMax: number;
  restSec: number;
}

export interface ExerciseInstructionStep {
  stepNumber: number;
  title: string;
  description: string;
  /** Öffentliche URL, lokaler Pfad oder `idb:<key>` für selbst hochgeladene Bilder. `null` = kein Foto vorhanden */
  imageUrl: string | null;
  altText: string;
}

export interface Exercise {
  id: string;
  name: string;
  description: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  difficulty: Difficulty;
  type: ExerciseType;
  pattern: MovementPattern;
  instructions: string[];
  techniqueTips: string[];
  commonMistakes: string[];
  safetyNotes: string[];
  recommended: RepRange;
  /** Einheit der „Wiederholungen“ – bei Halteübungen Sekunden */
  repUnit?: 'wdh' | 'sek' | 'm';
  imageUrl: string | null;
  photoGuide: ExerciseInstructionStep[];
  alternatives: string[];
  isCustom: boolean;
  /** Quelle/Lizenz der Bilder */
  imageCredit?: string;
}

// ---------- Persönliche Daten ----------

export interface ExerciseCollection {
  id: string;
  name: string;
  description: string;
  exerciseIds: string[];
  createdAt: string;
}

export interface PlanExercise {
  uid: string;
  exerciseId: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSec: number;
  targetWeight: number | null;
  notes: string;
}

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Montag

export interface PlanDay {
  id: string;
  name: string;
  weekday: Weekday | null;
  muscles: MuscleGroup[];
  exercises: PlanExercise[];
}

export type TrainingGoal = 'muskelaufbau' | 'maximalkraft' | 'fitness' | 'grundlagen';
export type Experience = 'anfaenger' | 'fortgeschritten' | 'erfahren';

export interface WorkoutPlan {
  id: string;
  name: string;
  description: string;
  goal: TrainingGoal | null;
  days: PlanDay[];
  notes: string;
  createdAt: string;
  updatedAt: string;
  generated?: GeneratorInput | null;
}

export interface SetLog {
  targetRepsMin: number;
  targetRepsMax: number;
  targetWeight: number | null;
  reps: number | null;
  weight: number | null;
  done: boolean;
}

/** Snapshot – unabhängig von späteren Planänderungen */
export interface SessionExercise {
  exerciseId: string;
  exerciseName: string;
  primaryMuscle: MuscleGroup;
  restSec: number;
  notes: string;
  sets: SetLog[];
}

export type SessionStatus = 'aktiv' | 'pausiert' | 'abgeschlossen' | 'abgebrochen';

export interface WorkoutSession {
  id: string;
  planId: string | null;
  planName: string;
  dayId: string | null;
  dayName: string;
  startedAt: string;
  endedAt: string | null;
  /** Akkumulierte Pausenzeit des Trainings in ms */
  pausedMs: number;
  pausedAt: string | null;
  exercises: SessionExercise[];
  currentIndex: number;
  notes: string;
  status: SessionStatus;
  /** Gewichtseinheit zum Zeitpunkt der Aufzeichnung; Gewichte werden intern immer in kg gespeichert */
  unit: 'kg';
}

export type Unit = 'kg' | 'lb';
export type ThemeMode = 'dark' | 'light';
export type AccentColor = 'brand' | 'lime';

export interface UserSettings {
  unit: Unit;
  theme: ThemeMode;
  accent: AccentColor;
  defaultRestSec: number;
  preferredEquipment: Equipment[];
  defaultSets: number;
  defaultRepsMin: number;
  defaultRepsMax: number;
  userName: string;
  reducedMotion: boolean;
}

export interface AppData {
  version: number;
  customExercises: Exercise[];
  favorites: string[];
  collections: ExerciseCollection[];
  plans: WorkoutPlan[];
  activePlanId: string | null;
  sessions: WorkoutSession[];
  activeSession: WorkoutSession | null;
  settings: UserSettings;
}

// ---------- Generator ----------

export type EquipmentPreset =
  | 'voll'
  | 'maschinen'
  | 'kabel'
  | 'freie_gewichte'
  | 'kurzhanteln'
  | 'langhanteln'
  | 'multipresse'
  | 'eigengewicht'
  | 'individuell';

export interface GeneratorDayInput {
  weekday: Weekday;
  name: string;
  muscles: MuscleGroup[];
}

export interface GeneratorInput {
  goal: TrainingGoal;
  experience: Experience;
  frequency: number;
  weekdays: Weekday[];
  muscles: MuscleGroup[];
  splitMode: 'auto' | 'manuell';
  days: GeneratorDayInput[];
  durationMin: number | null;
  equipmentPreset: EquipmentPreset;
  equipment: Equipment[];
}

export interface GeneratorWarning {
  level: 'info' | 'warn';
  message: string;
}
