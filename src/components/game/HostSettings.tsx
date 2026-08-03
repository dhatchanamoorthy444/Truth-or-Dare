/** Host-only game configuration panel — used when creating a party and in-room. */
import {
  DIFFICULTY_SETTINGS,
  LUCKY_OPTIONS,
  MYSTERY_OPTIONS,
  REPEAT_MODES,
  SCENARIOS,
  SKIP_OPTIONS,
  TURN_OPTIONS,
  VERIFICATION_MODES,
  WHEEL_MODES,
  categoriesForScenarios,
  formatTurn,
  type GameSettings,
} from "@/lib/round-engine";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`press-3d rounded-xl px-3 py-2 text-[11px] font-bold transition ${
        active
          ? "bg-primary text-primary-foreground neon-glow"
          : "bg-secondary/60 text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export function HostSettings({
  settings,
  scenarios,
  onScenarios,
  onChange,
}: {
  settings: GameSettings;
  scenarios: string[];
  onScenarios: (ids: string[]) => void;
  onChange: (patch: Partial<GameSettings>) => void;
}) {
  const toggleScenario = (id: string) => {
    const next = scenarios.includes(id) ? scenarios.filter((s) => s !== id) : [...scenarios, id];
    onScenarios(next);
    onChange({ categories: categoriesForScenarios(next) });
  };

  return (
    <div className="space-y-4">
      <Row label="Question scenarios">
        {SCENARIOS.map((s) => (
          <Chip key={s.id} active={scenarios.includes(s.id)} onClick={() => toggleScenario(s.id)}>
            {s.emoji} {s.label}
          </Chip>
        ))}
      </Row>

      <Row label="Imposter mode">
        <Chip active={settings.imposter} onClick={() => onChange({ imposter: true })}>
          On
        </Chip>
        <Chip active={!settings.imposter} onClick={() => onChange({ imposter: false })}>
          Off
        </Chip>
      </Row>

      <Row label="Transfer challenge">
        <Chip active={settings.transfers} onClick={() => onChange({ transfers: true })}>
          On
        </Chip>
        <Chip active={!settings.transfers} onClick={() => onChange({ transfers: false })}>
          Off
        </Chip>
      </Row>

      <Row label="Wheel selection">
        {WHEEL_MODES.map((w) => (
          <Chip key={w.id} active={settings.wheelMode === w.id} onClick={() => onChange({ wheelMode: w.id })}>
            {w.label}
          </Chip>
        ))}
      </Row>

      <Row label="Question difficulty">
        {DIFFICULTY_SETTINGS.map((d) => (
          <Chip key={d.id} active={settings.difficulty === d.id} onClick={() => onChange({ difficulty: d.id })}>
            {d.label}
          </Chip>
        ))}
      </Row>

      <Row label="Question repeat">
        {REPEAT_MODES.map((r) => (
          <Chip key={r.id} active={settings.repeat === r.id} onClick={() => onChange({ repeat: r.id })}>
            {r.label}
          </Chip>
        ))}
      </Row>

      <Row label="Challenge timer">
        {TURN_OPTIONS.map((t) => (
          <Chip key={t} active={settings.turnSeconds === t} onClick={() => onChange({ turnSeconds: t })}>
            {formatTurn(t)}
          </Chip>
        ))}
      </Row>

      <Row label="Dare verification">
        {VERIFICATION_MODES.map((v) => (
          <Chip key={v.id} active={settings.verification === v.id} onClick={() => onChange({ verification: v.id })}>
            {v.label}
          </Chip>
        ))}
      </Row>

      <Row label="Voice chat">
        <Chip active={settings.voiceChat} onClick={() => onChange({ voiceChat: true })}>
          On
        </Chip>
        <Chip active={!settings.voiceChat} onClick={() => onChange({ voiceChat: false })}>
          Off
        </Chip>
      </Row>

      <Row label="Video call mode">
        <Chip active={settings.videoChat} onClick={() => onChange({ videoChat: true })}>
          On
        </Chip>
        <Chip active={!settings.videoChat} onClick={() => onChange({ videoChat: false })}>
          Off
        </Chip>
      </Row>

      <Row label="Skip cards">
        {SKIP_OPTIONS.map((s) => (
          <Chip key={s} active={settings.skips === s} onClick={() => onChange({ skips: s })}>
            {s === -1 ? "Unlimited" : `${s} skip`}
          </Chip>
        ))}
      </Row>

      <Row label="Double dare">
        <Chip active={settings.doubleDare} onClick={() => onChange({ doubleDare: true })}>
          On
        </Chip>
        <Chip active={!settings.doubleDare} onClick={() => onChange({ doubleDare: false })}>
          Off
        </Chip>
      </Row>

      <Row label="Punishment mode">
        <Chip active={settings.punishments} onClick={() => onChange({ punishments: true })}>
          On
        </Chip>
        <Chip active={!settings.punishments} onClick={() => onChange({ punishments: false })}>
          Off
        </Chip>
      </Row>

      <Row label="Voting required">
        <Chip active={settings.voting} onClick={() => onChange({ voting: true })}>
          On
        </Chip>
        <Chip active={!settings.voting} onClick={() => onChange({ voting: false })}>
          Off
        </Chip>
      </Row>

      <Row label="Mystery box chance">
        {MYSTERY_OPTIONS.map((m) => (
          <Chip key={m} active={settings.mysteryChance === m} onClick={() => onChange({ mysteryChance: m })}>
            {m}%
          </Chip>
        ))}
      </Row>

      <Row label="Lucky save chance">
        {LUCKY_OPTIONS.map((l) => (
          <Chip key={l} active={settings.luckyChance === l} onClick={() => onChange({ luckyChance: l })}>
            {l}%
          </Chip>
        ))}
      </Row>
    </div>
  );
}