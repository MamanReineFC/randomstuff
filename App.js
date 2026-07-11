// Wellness Deck
// Copyright (c) 2026 FC. All rights reserved. See LICENSE.

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  SafeAreaView, ScrollView, View, Text, TextInput, Pressable,
  StyleSheet, Animated, Easing, StatusBar, Platform, Vibration,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CBT_EXERCISES } from "./data/cbt";
import { SOMATIC_EXERCISES } from "./data/somatic";
import { CPTSD_EXERCISES } from "./data/cptsd";

// ---------- Sources (former decks) ----------
const SOURCES = {
  cbt: {
    label: "CBT",
    scaleLabel: ["Mood before (0 low – 10 high)", "Mood after (0 low – 10 high)"],
    scaleWord: "Mood",
  },
  somatic: {
    label: "Somatic",
    scaleLabel: ["How settled do you feel? (0 restless – 10 calm)", "And now? (0 restless – 10 calm)"],
    scaleWord: "Settled",
  },
  cptsd: {
    label: "C-PTSD",
    scaleLabel: ["How settled do you feel? (0 overwhelmed – 10 grounded)", "And now? (0 overwhelmed – 10 grounded)"],
    scaleWord: "Settled",
  },
};

// ---------- Four simplified categories ----------
// Every card is mapped onto one of four groups, then each group is capped
// so the deck stays focused.
const CATS = ["CBT", "Somatic", "Grounding/Self-Compassion", "Mindfulness/Breathing"];
const CAT_MAP = {
  // CBT
  "Cognitive Restructuring": "CBT",
  "Self-Monitoring": "CBT",
  "Behavioral Activation": "CBT",
  "Understand": "CBT",
  "Reframe": "CBT",
  "Exposure & Testing": "CBT",
  // Somatic
  "Body Awareness": "Somatic",
  "Movement & Release": "Somatic",
  // Grounding / Self-Compassion
  "Sensory Grounding": "Grounding/Self-Compassion",
  "Grounding": "Grounding/Self-Compassion",
  "Grounding & Emotion": "Grounding/Self-Compassion",
  "Triggers": "Grounding/Self-Compassion",
  "Flashbacks": "Grounding/Self-Compassion",
  "Self-Compassion": "Grounding/Self-Compassion",
  "Self-Soothing": "Grounding/Self-Compassion",
  "Recovery": "Grounding/Self-Compassion",
  // Mindfulness / Breathing
  "Breathwork": "Mindfulness/Breathing",
  "Mindful Attention": "Mindfulness/Breathing",
  "Regulate": "Mindfulness/Breathing",
};
// Per-card overrides where a card fits a group better than its raw category
const CARD_CAT = {
  "cbt-14": "Mindfulness/Breathing",  // Paced Breathing (4-6)
};
const mapCat = (uid, cat) => CARD_CAT[uid] || CAT_MAP[cat] || cat;

// Max cards kept per category
const CAT_CAP = 25;

// One card pool: tag each exercise with its source and simplified category,
// then cap each category so none is overloaded.
const ALL_EXERCISES = (() => {
  const tagged = [
    ...CBT_EXERCISES.map(e => ({ ...e, source: "cbt", uid: `cbt-${e.id}` })),
    ...SOMATIC_EXERCISES.map(e => ({ ...e, source: "somatic", uid: `som-${e.id}` })),
    ...CPTSD_EXERCISES.map(e => ({ ...e, source: "cptsd", uid: `cpt-${e.id}` })),
  ].map(e => ({ ...e, cat: mapCat(e.uid, e.cat) }));
  const counts = {};
  return tagged.filter(e => {
    counts[e.cat] = (counts[e.cat] || 0) + 1;
    return counts[e.cat] <= CAT_CAP;
  });
})();

// ---------- Unified theme ----------
const T = {
  bg: "#EFEFEA", card: "#FCFCF9", border: "#DEDFD6", ink: "#282B26",
  dim: "#82837A", mid: "#4F534B", soft: "#F2F3EC", input: "#F6F7F1",
};

// Accent color for each of the four categories
const CAT_COLOR = {
  "CBT": "#4E6E8E",
  "Somatic": "#6E7F5A",
  "Grounding/Self-Compassion": "#8E6B77",
  "Mindfulness/Breathing": "#5B7C8D",
};

const STORE_KEY = "wellness-journal-v1";
const LEGACY_KEYS = { cbt: "deck-journal-cbt-v1", somatic: "deck-journal-somatic-v1", cptsd: "deck-journal-cptsd-v1" };

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
  } catch { return iso; }
}

// ---------- Breath pacer (10s cycle) ----------
function BreathPacer({ color }) {
  const scale = useRef(new Animated.Value(0.8)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.15, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(1000),
        Animated.timing(scale, { toValue: 0.8, duration: 4500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(500),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scale]);
  return (
    <View style={{ alignItems: "center", marginVertical: 12 }}>
      <Animated.View style={{
        width: 72, height: 72, borderRadius: 36,
        backgroundColor: color + "22", borderWidth: 2, borderColor: color,
        transform: [{ scale }],
      }} />
      <Text style={{ fontSize: 11, color: T.dim, marginTop: 8, letterSpacing: 1, textTransform: "uppercase" }}>
        Breathe with the circle
      </Text>
    </View>
  );
}

// ---------- 0–10 scale ----------
function Scale({ value, onChange, label, accent }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[styles.smallLabel, { color: T.dim }]}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
        {Array.from({ length: 11 }, (_, n) => (
          <Pressable key={n} onPress={() => onChange(n)}
            style={{
              width: 30, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center",
              borderWidth: 1, borderColor: value === n ? accent : T.border,
              backgroundColor: value === n ? accent : T.card,
            }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: value === n ? T.card : T.mid }}>{n}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ---------- Countdown timer ----------
function CardTimer({ minutes, accent }) {
  const total = Math.max(1, Math.round(minutes * 60));
  const [remaining, setRemaining] = useState(total);
  const [running, setRunning] = useState(false);
  const finished = remaining === 0;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          clearInterval(id);
          setRunning(false);
          Vibration.vibrate(600);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, "0");
  const progress = 1 - remaining / total;

  return (
    <View style={{
      backgroundColor: T.soft, borderRadius: 12, padding: 14, marginBottom: 14,
      borderWidth: 1, borderColor: T.border,
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{
          fontSize: 30, fontWeight: "600", color: finished ? accent : T.ink,
          fontVariant: ["tabular-nums"],
        }}>
          {mm}:{ss}
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {!finished && (
            <Pressable onPress={() => setRunning(r => !r)}
              style={{
                backgroundColor: running ? T.card : accent, borderRadius: 10,
                paddingVertical: 9, paddingHorizontal: 20,
                borderWidth: 1, borderColor: accent,
              }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: running ? accent : T.card }}>
                {running ? "Pause" : remaining < total ? "Resume" : "Start"}
              </Text>
            </Pressable>
          )}
          {(remaining < total || finished) && (
            <Pressable onPress={() => { setRunning(false); setRemaining(total); }}
              style={{
                borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14,
                borderWidth: 1, borderColor: T.border, backgroundColor: T.card,
              }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: T.mid }}>Reset</Text>
            </Pressable>
          )}
        </View>
      </View>
      {/* Progress bar */}
      <View style={{ height: 5, borderRadius: 3, backgroundColor: T.border, marginTop: 12, overflow: "hidden" }}>
        <View style={{ height: 5, width: `${Math.round(progress * 100)}%`, backgroundColor: accent }} />
      </View>
      {finished && (
        <Text style={{ fontSize: 13, color: T.mid, marginTop: 8 }}>
          Time's up — nicely done. Take one more breath before moving on.
        </Text>
      )}
    </View>
  );
}

export default function App() {
  const [view, setView] = useState("deck");
  const [cat, setCat] = useState("CBT");
  const [current, setCurrent] = useState(null);
  const [done, setDone] = useState({});
  const [note, setNote] = useState("");
  const [before, setBefore] = useState(null);
  const [after, setAfter] = useState(null);
  const [historyIds, setHistoryIds] = useState([]);
  const [entries, setEntries] = useState([]);
  const [saveState, setSaveState] = useState("idle");

  // The four fixed categories
  const cats = useMemo(() => CATS, []);

  const pool = useMemo(
    () => ALL_EXERCISES.filter(e => e.cat === cat),
    [cat]
  );

  // Load journal; migrate legacy per-deck journals on first launch
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORE_KEY);
        if (raw) { setEntries(JSON.parse(raw)); return; }
        // Migration: gather any entries from the old three journals
        let merged = [];
        for (const [src, key] of Object.entries(LEGACY_KEYS)) {
          const legacy = await AsyncStorage.getItem(key);
          if (legacy) {
            const list = JSON.parse(legacy).map(e => ({ ...e, source: e.source || src }));
            merged = merged.concat(list);
          }
        }
        if (merged.length) {
          merged.sort((a, b) => (a.ts < b.ts ? 1 : -1));
          await AsyncStorage.setItem(STORE_KEY, JSON.stringify(merged));
          setEntries(merged);
        }
      } catch { /* start fresh */ }
    })();
  }, []);

  const draw = () => {
    let candidates = pool.filter(e => !historyIds.slice(-Math.min(5, pool.length - 1)).includes(e.uid));
    if (candidates.length === 0) candidates = pool;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    setCurrent(pick);
    setDone({}); setNote(""); setBefore(null); setAfter(null); setSaveState("idle");
    setHistoryIds(h => [...h, pick.uid].slice(-12));
  };

  const toggleStep = (i) => setDone(d => ({ ...d, [i]: !d[i] }));
  const completed = current ? current.steps.filter((_, i) => done[i]).length : 0;
  const allDone = current && completed === current.steps.length;
  const accent = current ? (CAT_COLOR[current.cat] || "#5E7F78") : "#5E7F78";
  const srcInfo = current ? SOURCES[current.source] : null;
  const delta = (b, a) => (b == null || a == null) ? null : a - b;

  const saveEntry = async () => {
    if (!current) return;
    setSaveState("saving");
    const entry = {
      ts: new Date().toISOString(), title: current.title, cat: current.cat,
      source: current.source, before, after, note: note.trim(),
      scaleWord: srcInfo.scaleWord,
    };
    const next = [entry, ...entries].slice(0, 1000);
    try {
      await AsyncStorage.setItem(STORE_KEY, JSON.stringify(next));
      setEntries(next); setSaveState("saved");
    } catch { setSaveState("error"); }
  };

  const deleteEntry = async (ts) => {
    const next = entries.filter(e => e.ts !== ts);
    try {
      await AsyncStorage.setItem(STORE_KEY, JSON.stringify(next));
      setEntries(next);
    } catch {}
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>

        {/* Header */}
        <Text style={[styles.eyebrow, { color: T.dim }]}>One card · a few minutes · whatever today needs</Text>
        <Text style={[styles.h1, { color: T.ink }]}>Wellness Deck</Text>

        {/* Deck / Journal tabs */}
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 16, marginVertical: 14 }}>
          {[["deck", "Deck"], ["journal", `Journal${entries.length ? " · " + entries.length : ""}`]].map(([k, label]) => (
            <Pressable key={k} onPress={() => setView(k)}
              style={{ borderBottomWidth: 2, borderBottomColor: view === k ? T.ink : "transparent", paddingBottom: 4 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: view === k ? T.ink : T.dim }}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {view === "deck" && (
          <>
            {/* Category chips (unified taxonomy, alphabetical) */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 7, marginBottom: 14 }}>
              {cats.map(c => (
                  <Pressable key={c} onPress={() => setCat(c)}
                    style={{
                      paddingVertical: 6, paddingHorizontal: 11, borderRadius: 999,
                      borderWidth: 1, borderColor: cat === c ? (CAT_COLOR[c] || T.ink) : T.border,
                      backgroundColor: cat === c ? (CAT_COLOR[c] || T.ink) : "transparent",
                    }}>
                    <Text style={{ fontSize: 12, color: cat === c ? T.card : T.mid }}>{c}</Text>
                  </Pressable>
                ))}
              </View>

            {/* Draw button */}
            <Pressable onPress={draw}
              style={{
                alignSelf: "center", backgroundColor: accent, borderRadius: 12,
                paddingVertical: 14, paddingHorizontal: 34, marginBottom: 6, marginTop: 4,
                shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 3, shadowOffset: { width: 0, height: 2 },
              }}>
              <Text style={{ color: T.card, fontSize: 16, fontWeight: "700" }}>
                {current ? "Draw another card" : "Draw a card"}
              </Text>
            </Pressable>
            <Text style={{ textAlign: "center", fontSize: 12, color: T.dim, marginBottom: 20 }}>
              {pool.length} cards in this stack
            </Text>

            {/* Card */}
            {current && (
              <View style={{
                backgroundColor: T.card, borderRadius: 16, borderWidth: 1,
                borderColor: T.border, overflow: "hidden",
              }}>
                <View style={{ height: 6, backgroundColor: accent }} />
                <View style={{ padding: 20 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                    <Text style={{ fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: accent, fontWeight: "700", flexShrink: 1 }}>
                      {current.cat}
                    </Text>
                    <Text style={{ fontSize: 12, color: T.dim }}>
                      {SOURCES[current.source].label} · ~{current.mins} min
                    </Text>
                  </View>

                  <Text style={[styles.h2, { color: T.ink }]}>{current.title}</Text>
                  <Text style={{ fontSize: 14.5, lineHeight: 21, color: T.mid, fontStyle: "italic", marginBottom: 14 }}>
                    {current.why}
                  </Text>

                  {current.breath && <BreathPacer color={accent} />}

                  <CardTimer key={current.uid} minutes={current.mins} accent={accent} />

                  <Scale value={before} onChange={setBefore} label={srcInfo.scaleLabel[0]} accent={accent} />

                  {/* Steps */}
                  <View style={{ gap: 6, marginTop: 8 }}>
                    {current.steps.map((s, i) => (
                      <Pressable key={i} onPress={() => toggleStep(i)}
                        style={{
                          flexDirection: "row", gap: 12, padding: 10, borderRadius: 10,
                          backgroundColor: done[i] ? T.soft : "transparent",
                        }}>
                        <View style={{
                          width: 20, height: 20, borderRadius: 6, marginTop: 1,
                          borderWidth: 1.5, borderColor: done[i] ? accent : T.border,
                          backgroundColor: done[i] ? accent : "transparent",
                          alignItems: "center", justifyContent: "center",
                        }}>
                          {done[i] && <Text style={{ color: T.card, fontSize: 12, fontWeight: "700" }}>✓</Text>}
                        </View>
                        <Text style={{
                          flex: 1, fontSize: 15, lineHeight: 22,
                          color: done[i] ? T.dim : T.ink,
                          textDecorationLine: done[i] ? "line-through" : "none",
                        }}>{s}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={{ fontSize: 12.5, color: T.dim, marginVertical: 12 }}>
                    {allDone ? "All steps done — nice work." : `${completed} of ${current.steps.length} steps done`}
                  </Text>

                  {allDone && (
                    <Scale value={after} onChange={setAfter} label={srcInfo.scaleLabel[1]} accent={accent} />
                  )}

                  {before != null && after != null && (
                    <View style={{ backgroundColor: T.soft, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                      <Text style={{ fontSize: 14, color: T.ink }}>
                        {delta(before, after) > 0 && `${srcInfo.scaleWord} shifted +${delta(before, after)} — worth noting what helped.`}
                        {delta(before, after) === 0 && "No shift this time — the practice still counts."}
                        {delta(before, after) < 0 && "A dip can happen when attention meets what's really there. Go gently."}
                      </Text>
                    </View>
                  )}

                  <Text style={[styles.smallLabel, { color: T.dim }]}>Notes (optional)</Text>
                  <TextInput
                    value={note} onChangeText={setNote} multiline
                    placeholder="What came up?"
                    placeholderTextColor={T.dim}
                    style={{
                      minHeight: 90, backgroundColor: T.input, borderWidth: 1,
                      borderColor: T.border, borderRadius: 10, padding: 12,
                      fontSize: 15, color: T.ink, textAlignVertical: "top", marginBottom: 12,
                    }}
                  />

                  <Pressable onPress={saveEntry} disabled={saveState === "saving" || saveState === "saved"}
                    style={{
                      alignSelf: "flex-start", backgroundColor: saveState === "saved" ? T.dim : T.ink,
                      borderRadius: 10, paddingVertical: 11, paddingHorizontal: 22,
                    }}>
                    <Text style={{ color: T.card, fontSize: 14.5, fontWeight: "700" }}>
                      {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved to journal ✓" : "Save to journal"}
                    </Text>
                  </Pressable>
                  {saveState === "error" && (
                    <Text style={{ color: "#9A4F4F", fontSize: 13, marginTop: 8 }}>Couldn't save. Try again.</Text>
                  )}
                </View>
              </View>
            )}
          </>
        )}

        {view === "journal" && (
          <View style={{ gap: 12 }}>
            {entries.length === 0 && (
              <View style={{
                borderWidth: 1.5, borderStyle: "dashed", borderColor: T.border,
                borderRadius: 16, padding: 32, alignItems: "center",
              }}>
                <Text style={{ fontSize: 15, color: T.dim, textAlign: "center", lineHeight: 22 }}>
                  Nothing saved yet. Finish a card in the Deck tab and tap "Save to journal".
                </Text>
              </View>
            )}
            {entries.map(e => {
              const d = delta(e.before, e.after);
              const displayCat = CAT_MAP[e.cat] || e.cat;
              const c = CAT_COLOR[displayCat] || T.ink;
              const word = e.scaleWord || (SOURCES[e.source]?.scaleWord ?? "Mood");
              return (
                <View key={e.ts} style={{
                  backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
                  borderRadius: 14, padding: 16,
                }}>
                  <Text style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: c, fontWeight: "700" }}>
                    {displayCat}{e.source ? `  ·  ${SOURCES[e.source]?.label ?? e.source}` : ""}
                  </Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                    <Text style={{ fontSize: 18, color: T.ink, fontWeight: "600", marginTop: 2, flexShrink: 1 }}>
                      {e.title}
                    </Text>
                    <Text style={{ fontSize: 12, color: T.dim }}>{fmtDate(e.ts)}</Text>
                  </View>
                  {(e.before != null || e.after != null) && (
                    <Text style={{ fontSize: 13.5, color: T.mid, marginTop: 6 }}>
                      {word}: {e.before ?? "–"} → {e.after ?? "–"}{d != null ? ` (${d > 0 ? "+" : ""}${d})` : ""}
                    </Text>
                  )}
                  {!!e.note && (
                    <Text style={{ fontSize: 14.5, lineHeight: 21, color: T.ink, marginTop: 8 }}>{e.note}</Text>
                  )}
                  <Pressable onPress={() => deleteEntry(e.ts)} style={{ marginTop: 10 }}>
                    <Text style={{ fontSize: 12.5, color: T.dim, textDecorationLine: "underline" }}>
                      Delete entry
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        <Text style={{ fontSize: 12, lineHeight: 18, color: T.dim, textAlign: "center", marginTop: 28 }}>
          Gentle self-help practices — not therapy or medical advice.{"\n"}
          Go at your own pace, move within a comfortable range, and stop if a practice feels overwhelming or painful.{"\n"}
          If you're in crisis or thinking of harming yourself, please contact a crisis line or emergency services — reaching out is a sign of strength.{"\n"}
          Your journal is stored only on this device.
        </Text>

        <Text style={{ fontSize: 11, color: T.dim, textAlign: "center", marginTop: 10 }}>
          © 2026 FC · All rights reserved
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontSize: 11, letterSpacing: 2.4, textTransform: "uppercase",
    textAlign: "center", marginBottom: 8, marginTop: 8,
  },
  h1: {
    fontSize: 32, fontWeight: "500", textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  h2: {
    fontSize: 25, fontWeight: "500", marginBottom: 6,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  smallLabel: {
    fontSize: 12, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6,
  },
});
