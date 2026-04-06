import { Column, Entity, JoinColumn, OneToOne } from "typeorm";
import { AuditableEntity } from "./base/auditable.entity";
import { AgentParameter } from "./agent-parameter.entity";

export interface CoreVoiceDimension {
  value: string;
  weight: number;
}

export interface CoreVoiceProfile {
  formality: CoreVoiceDimension;
  humor: CoreVoiceDimension;
  verbosity: CoreVoiceDimension;
}

@Entity("voice_profiles")
export class VoiceProfile extends AuditableEntity {
  @Column({ name: "agent_parameter_id", type: "uuid" })
  agentParameterId!: string;

  @Column({ name: "core_voice_profile", type: "json", nullable: true })
  coreVoiceProfile!: CoreVoiceProfile;

  @Column({ name: "tonal_palette", type: "simple-array", nullable: true })
  tonalPalette?: string[];

  @Column({ name: "behavioral_guardrails", type: "simple-array", nullable: true })
  behavioralGuardrails?: string[];

  @OneToOne(() => AgentParameter, (agentParameter) => agentParameter.voiceProfile, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "agent_parameter_id" })
  agentParameter!: AgentParameter;
}
