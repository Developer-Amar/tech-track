/**
 * Tech Track — Shared TypeScript Types
 *
 * These mirror the database schema from Backend_Schema.md.
 * Generated types from Supabase CLI can supplement/replace these later.
 */

// ── User Roles ──────────────────────────────────────────────

export type UserRole = "participant" | "checkpoint_staff" | "admin" | "super_admin";

// ── Users ───────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  mobile_number: string | null;
  roll_no: string | null;
  branch: string | null;
  semester: number | null;
  role: UserRole;
  profile_completed: boolean;
  created_at: string;
  updated_at: string;
}

// ── Units (solo or team — the universal "participant entity") ──

export type UnitType = "solo" | "team";

export interface Unit {
  id: string;
  unit_type: UnitType;
  name: string | null;
  leader_id: string;
  locked: boolean;
  locked_at: string | null;
  disqualified: boolean;
  disqualified_reason: string | null;
  disqualified_at: string | null;
  created_at: string;
}

// ── Unit Members ────────────────────────────────────────────

export type InviteStatus = "pending" | "accepted" | "declined";

export interface UnitMember {
  id: string;
  unit_id: string;
  user_id: string;
  status: InviteStatus;
  invited_at: string;
  responded_at: string | null;
}

// ── Checkpoints (the central "round" entity) ────────────────

export interface Checkpoint {
  id: string;
  location_name: string;
  round_number: number;
  created_at: string;
  updated_at: string;
}

// ── Riddles ─────────────────────────────────────────────────

export interface Riddle {
  id: string;
  checkpoint_id: string;
  content: string;
  updated_at: string;
}

// ── Checkpoint Staff Assignments ────────────────────────────

export interface CheckpointStaffAssignment {
  id: string;
  user_id: string;
  checkpoint_id: string;
}

// ── Secret Codes ────────────────────────────────────────────

export interface UnitCheckpointCode {
  id: string;
  unit_id: string;
  checkpoint_id: string;
  secret_code: string;
}

// ── Coding Questions ────────────────────────────────────────

export interface CodingQuestion {
  id: string;
  checkpoint_id: string;
  prompt: string;
  sample_input: string | null;
  sample_output: string | null;
  updated_at: string;
}

// ── Test Cases ──────────────────────────────────────────────

export interface TestCase {
  id: string;
  question_id: string;
  input: string;
  expected_output: string;
  is_visible: boolean;
}

// ── Submissions ─────────────────────────────────────────────

export type Language = "c" | "cpp" | "python";

export interface Submission {
  id: string;
  unit_id: string;
  checkpoint_id: string;
  code: string;
  language: Language;
  passed: boolean;
  attempt_number: number;
  submitted_at: string;
}

// ── Round Progress ──────────────────────────────────────────

export type RoundStatus = "pending" | "skipped" | "passed";

export interface RoundProgress {
  id: string;
  unit_id: string;
  checkpoint_id: string;
  status: RoundStatus;
  points: number;
  completed_at: string | null;
}

// ── Proctoring Events ───────────────────────────────────────

export interface ProctoringEvent {
  id: string;
  unit_id: string;
  checkpoint_id: string | null;
  event_type: string;
  occurred_at: string;
}

// ── Announcements ───────────────────────────────────────────

export interface Announcement {
  id: string;
  message: string;
  created_by: string;
  created_at: string;
}

// ── Notifications ───────────────────────────────────────────

export interface Notification {
  id: string;
  unit_id: string;
  message: string;
  created_by: string;
  created_at: string;
  read: boolean;
}

// ── Audit Log ───────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  actor_id: string;
  action_type: string;
  action_detail: Record<string, unknown> | null;
  created_at: string;
}

// ── Event Settings (singleton) ──────────────────────────────

export interface EventSettings {
  id: number;
  registration_open: boolean;
  event_live: boolean;
  total_rounds: number;
}

// ── Views ───────────────────────────────────────────────────

export interface LeaderboardEntry {
  unit_id: string;
  name: string | null;
  unit_type: UnitType;
  disqualified: boolean;
  total_points: number;
  last_point_at: string | null;
}

export interface AdminUnitOverview {
  unit_id: string;
  name: string | null;
  unit_type: UnitType;
  locked: boolean;
  disqualified: boolean;
  members: Array<{
    name: string;
    email: string;
    role: "leader" | "member";
  }>;
  total_points: number;
}
