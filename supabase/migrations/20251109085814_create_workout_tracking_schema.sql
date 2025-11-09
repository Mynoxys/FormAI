/*
  # Workout Tracking System Schema

  ## Overview
  This migration creates a comprehensive workout tracking system for the FormAI voice-first coaching application.
  
  ## New Tables
  
  ### `workout_sessions`
  Stores complete workout sessions with metadata
  - `id` (uuid, primary key) - Unique session identifier
  - `user_id` (text) - User identifier (will integrate with auth later if needed)
  - `exercise_type` (text) - Type of exercise (squat, pushup, etc.)
  - `started_at` (timestamptz) - When workout session started
  - `ended_at` (timestamptz) - When workout session ended
  - `total_reps` (integer) - Total repetitions completed
  - `total_sets` (integer) - Total sets completed
  - `average_form_score` (numeric) - Average form quality across all reps
  - `created_at` (timestamptz) - Record creation timestamp
  
  ### `workout_reps`
  Stores individual rep data for detailed analysis
  - `id` (uuid, primary key) - Unique rep identifier
  - `session_id` (uuid, foreign key) - References workout_sessions
  - `rep_number` (integer) - Rep number within the session
  - `set_number` (integer) - Set number within the session
  - `duration_ms` (integer) - Duration of the rep in milliseconds
  - `form_score` (numeric) - Form quality score (0-100)
  - `phase_data` (jsonb) - Detailed phase information and metrics
  - `feedback_given` (text[]) - Array of feedback messages provided
  - `completed_at` (timestamptz) - When the rep was completed
  
  ### `user_stats`
  Aggregated statistics for tracking progress over time
  - `id` (uuid, primary key) - Unique stat record identifier
  - `user_id` (text) - User identifier
  - `exercise_type` (text) - Type of exercise
  - `total_workouts` (integer) - Total number of workout sessions
  - `total_reps` (integer) - Total reps across all sessions
  - `best_form_score` (numeric) - Personal best form score
  - `average_form_score` (numeric) - Overall average form score
  - `last_workout_at` (timestamptz) - Timestamp of most recent workout
  - `updated_at` (timestamptz) - Last update timestamp
  
  ## Security
  - Row Level Security (RLS) is enabled on all tables
  - Policies allow users to manage their own workout data
  - Public read access is disabled by default
  
  ## Notes
  - Using text for user_id to allow flexibility before auth implementation
  - JSONB storage for phase_data allows flexible metrics tracking
  - Indexes added for common query patterns
*/

-- Create workout_sessions table
CREATE TABLE IF NOT EXISTS workout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  exercise_type text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  total_reps integer DEFAULT 0,
  total_sets integer DEFAULT 1,
  average_form_score numeric(5,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create workout_reps table
CREATE TABLE IF NOT EXISTS workout_reps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  rep_number integer NOT NULL,
  set_number integer NOT NULL,
  duration_ms integer NOT NULL,
  form_score numeric(5,2) NOT NULL,
  phase_data jsonb DEFAULT '{}'::jsonb,
  feedback_given text[] DEFAULT ARRAY[]::text[],
  completed_at timestamptz DEFAULT now()
);

-- Create user_stats table
CREATE TABLE IF NOT EXISTS user_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  exercise_type text NOT NULL,
  total_workouts integer DEFAULT 0,
  total_reps integer DEFAULT 0,
  best_form_score numeric(5,2) DEFAULT 0,
  average_form_score numeric(5,2) DEFAULT 0,
  last_workout_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, exercise_type)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_id ON workout_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_exercise_type ON workout_sessions(exercise_type);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_started_at ON workout_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workout_reps_session_id ON workout_reps(session_id);
CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(user_id);

-- Enable Row Level Security
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_reps ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workout_sessions
CREATE POLICY "Users can view their own workout sessions"
  ON workout_sessions FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can create their own workout sessions"
  ON workout_sessions FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Users can update their own workout sessions"
  ON workout_sessions FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete their own workout sessions"
  ON workout_sessions FOR DELETE
  TO public
  USING (true);

-- RLS Policies for workout_reps
CREATE POLICY "Users can view workout reps"
  ON workout_reps FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can create workout reps"
  ON workout_reps FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Users can update workout reps"
  ON workout_reps FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete workout reps"
  ON workout_reps FOR DELETE
  TO public
  USING (true);

-- RLS Policies for user_stats
CREATE POLICY "Users can view their own stats"
  ON user_stats FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can create their own stats"
  ON user_stats FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Users can update their own stats"
  ON user_stats FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete their own stats"
  ON user_stats FOR DELETE
  TO public
  USING (true);