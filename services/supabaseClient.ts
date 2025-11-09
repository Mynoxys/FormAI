import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface WorkoutSession {
  id?: string;
  user_id: string;
  exercise_type: string;
  started_at?: string;
  ended_at?: string | null;
  total_reps?: number;
  total_sets?: number;
  average_form_score?: number;
  created_at?: string;
}

export interface WorkoutRep {
  id?: string;
  session_id: string;
  rep_number: number;
  set_number: number;
  duration_ms: number;
  form_score: number;
  phase_data?: Record<string, any>;
  feedback_given?: string[];
  completed_at?: string;
}

export interface UserStats {
  id?: string;
  user_id: string;
  exercise_type: string;
  total_workouts?: number;
  total_reps?: number;
  best_form_score?: number;
  average_form_score?: number;
  last_workout_at?: string;
  updated_at?: string;
}

export const workoutService = {
  async startSession(userId: string, exerciseType: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: userId,
        exercise_type: exerciseType,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('Error starting session:', error);
      return null;
    }
    return data?.id || null;
  },

  async endSession(sessionId: string, totalReps: number, totalSets: number, avgFormScore: number): Promise<boolean> {
    const { error } = await supabase
      .from('workout_sessions')
      .update({
        ended_at: new Date().toISOString(),
        total_reps: totalReps,
        total_sets: totalSets,
        average_form_score: avgFormScore,
      })
      .eq('id', sessionId);

    if (error) {
      console.error('Error ending session:', error);
      return false;
    }
    return true;
  },

  async addRep(rep: WorkoutRep): Promise<boolean> {
    const { error } = await supabase
      .from('workout_reps')
      .insert({
        session_id: rep.session_id,
        rep_number: rep.rep_number,
        set_number: rep.set_number,
        duration_ms: rep.duration_ms,
        form_score: rep.form_score,
        phase_data: rep.phase_data || {},
        feedback_given: rep.feedback_given || [],
        completed_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error adding rep:', error);
      return false;
    }
    return true;
  },

  async updateUserStats(userId: string, exerciseType: string, sessionData: {
    totalReps: number;
    bestFormScore: number;
    avgFormScore: number;
  }): Promise<boolean> {
    const { data: existing } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .eq('exercise_type', exerciseType)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('user_stats')
        .update({
          total_workouts: (existing.total_workouts || 0) + 1,
          total_reps: (existing.total_reps || 0) + sessionData.totalReps,
          best_form_score: Math.max(existing.best_form_score || 0, sessionData.bestFormScore),
          average_form_score: sessionData.avgFormScore,
          last_workout_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('exercise_type', exerciseType);

      if (error) {
        console.error('Error updating user stats:', error);
        return false;
      }
    } else {
      const { error } = await supabase
        .from('user_stats')
        .insert({
          user_id: userId,
          exercise_type: exerciseType,
          total_workouts: 1,
          total_reps: sessionData.totalReps,
          best_form_score: sessionData.bestFormScore,
          average_form_score: sessionData.avgFormScore,
          last_workout_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Error creating user stats:', error);
        return false;
      }
    }
    return true;
  },

  async getUserStats(userId: string, exerciseType: string): Promise<UserStats | null> {
    const { data, error } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .eq('exercise_type', exerciseType)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user stats:', error);
      return null;
    }
    return data;
  },

  async getRecentSessions(userId: string, limit: number = 10): Promise<WorkoutSession[]> {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching recent sessions:', error);
      return [];
    }
    return data || [];
  },
};
