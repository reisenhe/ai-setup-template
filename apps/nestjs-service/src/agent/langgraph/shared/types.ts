/**
 * 用户意图类型
 * - collect_info: 需要收集用户基本信息
 * - generate_both: 首次生成，需要训练+饮食计划
 * - adjust_training: 只需要调整训练计划（如"周三休息"、"周末也训练"）
 * - adjust_diet: 只需要调整饮食计划（如"对牛奶过敏"、"想吃更多鱼肉"）
 * - adjust_both: 需要同时调整训练和饮食计划
 */
export type UserIntent =
  | 'collect_info'
  | 'generate_both'
  | 'adjust_training'
  | 'adjust_diet'
  | 'adjust_both';

/**
 * 健身规划的用户信息
 */
export interface UserInfo {
  gender?: 'male' | 'female';
  ageRange?: '18-25' | '26-35' | '36-45' | '46-55' | '55+';
  trainingGoal?: 'muscle_gain' | 'fat_loss';
}

/**
 * 训练日中的单个训练动作
 */
export interface Exercise {
  name: string;
  sets: number;
  reps: string;
  restSeconds: number;
}

/**
 * 训练日结构
 */
export interface TrainingDay {
  focus: string;
  exercises: Exercise[];
}

/**
 * 周训练计划（周一到周五）
 */
export interface TrainingPlan {
  monday: TrainingDay;
  tuesday: TrainingDay;
  wednesday: TrainingDay;
  thursday: TrainingDay;
  friday: TrainingDay;
}

/**
 * 宏量营养素分解
 */
export interface Macros {
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * 单餐结构
 */
export interface Meal {
  foods: string[];
  calories: number;
  macros: Macros;
}

/**
 * 每日饮食计划（三餐）
 */
export interface DietPlan {
  breakfast: Meal;
  lunch: Meal;
  dinner: Meal;
}

/**
 * 用户信息不完整时的可选项
 */
export interface UserInputOptions {
  gender: string[];
  ageRange: string[];
  trainingGoal: string[];
}

/**
 * 最终输出格式
 */
export interface FitnessCoachOutput {
  success: boolean;
  needsInput?: boolean;
  missingFields?: string[];
  options?: UserInputOptions;
  userInfo?: UserInfo;
  trainingPlan?: TrainingPlan;
  dietPlan?: DietPlan;
}

// 从 state 文件重新导出状态相关类型
export {
  FitnessCoachStateAnnotation,
  type FitnessCoachState,
} from '../../state/fitness-coach.state';

