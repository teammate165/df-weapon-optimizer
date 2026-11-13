"""Automatic-fire timing, in milliseconds; independent of Burst-mode fields.

Install the separately sourced observation: python tools/firing_timeline.py
"""
import json
import math
import sqlite3
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OBSERVATION = ROOT / 'data/timing/an94.json'


def install_observation(db):
    record = json.loads(OBSERVATION.read_text('utf-8'))
    db.execute('''CREATE TABLE IF NOT EXISTS automatic_timing_overrides (
        profile_key TEXT PRIMARY KEY REFERENCES weapons(profile_key),
        record_json TEXT NOT NULL CHECK(json_valid(record_json)))''')
    db.execute('INSERT INTO automatic_timing_overrides VALUES (?,?) '
               'ON CONFLICT(profile_key) DO UPDATE SET record_json=excluded.record_json',
               (record['profile_key'], json.dumps(record, ensure_ascii=False)))


@dataclass(frozen=True)
class AutomaticTiming:
    opening_intervals_ms: tuple
    sustained_interval_ms: float
    reset_threshold_ms: float | None = None
    reset_reference: str | None = None

    def __post_init__(self):
        for value in (*self.opening_intervals_ms, self.sustained_interval_ms):
            if not math.isfinite(value) or value <= 0:
                raise ValueError('Shot intervals must be finite and positive')
        if self.reset_threshold_ms is not None:
            if not math.isfinite(self.reset_threshold_ms) or self.reset_threshold_ms < 0:
                raise ValueError('Invalid reset threshold')
            if self.reset_reference not in ('last_shot', 'trigger_release'):
                raise ValueError('Reset reference must be last_shot or trigger_release')

    def interval_after(self, shot_count):
        if shot_count <= len(self.opening_intervals_ms):
            return self.opening_intervals_ms[shot_count - 1]
        return self.sustained_interval_ms


def load_timing(db, profile_key, mode):
    """Read mode-specific catalog timing and then a separate observation override."""
    row = db.execute('SELECT weapon_id FROM weapons WHERE profile_key=?', (profile_key,)).fetchone()
    if row is None:
        raise ValueError('Unknown weapon profile')
    row = db.execute('SELECT rpm,record_json FROM weapon_mode_stats WHERE weapon_id=? AND mode=?',
                     (row[0], mode)).fetchone()
    if row is None:
        raise ValueError('Unknown weapon/mode')
    rpm, raw = row
    opening = ()
    for rule in json.loads(raw).get('fire_schedule_rules') or []:
        if rule.get('mode') == 'firstShotsRpm':
            opening = (60000 / rule['rpm'],) * (rule['shots'] - 1)
            rpm = rule['sustainedRpm']
    timing = AutomaticTiming(opening, 60000 / rpm)
    if db.execute("SELECT 1 FROM sqlite_master WHERE name='automatic_timing_overrides'").fetchone():
        row = db.execute('SELECT record_json FROM automatic_timing_overrides WHERE profile_key=?',
                         (profile_key,)).fetchone()
        if row:
            record = json.loads(row[0])
            timing = AutomaticTiming(tuple(record['opening_intervals_ms']),
                                     record['sustained_interval_ms'],
                                     record['reset_threshold_ms'], record['reset_reference'])
    return timing


def firing_timeline(timing, trigger_windows):
    """Return shot times for sorted, nonoverlapping [press, release) windows.

    A fresh session starts reset. Multiple windows require an explicit reset rule;
    no reset threshold is guessed. Cooldown remains in force on early represses.
    Empty windows do not change the accelerated-sequence state.
    """
    windows = list(trigger_windows)
    previous_end = -math.inf
    for start, end in windows:
        if not (math.isfinite(start) and math.isfinite(end) and 0 <= start <= end):
            raise ValueError('Invalid trigger window')
        if start < previous_end:
            raise ValueError('Trigger windows must be sorted and nonoverlapping')
        previous_end = end
    windows = [(start, end) for start, end in windows if start < end]
    if len(windows) > 1 and timing.reset_threshold_ms is None:
        raise ValueError('Pause/reset timing is unmeasured; supply an explicit reset rule')
    shots = []
    sequence_count = 0
    last_release = None
    for start, end in windows:
        next_shot = start
        if shots:
            anchor = shots[-1] if timing.reset_reference == 'last_shot' else last_release
            reset = start - anchor >= timing.reset_threshold_ms
            next_shot = max(start, shots[-1] + timing.interval_after(sequence_count))
            if reset:
                sequence_count = 0
        while next_shot < end:
            shots.append(next_shot)
            sequence_count += 1
            next_shot += timing.interval_after(sequence_count)
        last_release = end
    return shots


if __name__ == '__main__':
    with sqlite3.connect(ROOT / 'delta_force_weapons.sqlite') as connection:
        install_observation(connection)
    print('Installed separate AN94 automatic timing observation; reset remains unmeasured.')
