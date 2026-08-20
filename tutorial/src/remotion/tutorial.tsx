import React from "react";
import {AbsoluteFill, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from "remotion";

export interface RenderScene {
  id: string;
  kind: "synthetic" | "capture";
  title: string;
  eyebrow?: string;
  bullets: string[];
  startFrame: number;
  durationInFrames: number;
  mediaPath?: string;
}

export interface TutorialProps {
  [key: string]: unknown;
  title: string;
  scenes: RenderScene[];
}

const colors = {
  night: "#151826",
  ink: "#23263a",
  cream: "#fbf6ec",
  coral: "#ff765f",
  gold: "#f3be5a",
  mint: "#90d7c5",
};

const BrandMark: React.FC = () => (
  <div style={{display: "flex", alignItems: "center", gap: 18}}>
    <div style={{width: 54, height: 54, borderRadius: 18, background: colors.coral, position: "relative"}}>
      <div style={{position: "absolute", width: 22, height: 22, border: `6px solid ${colors.cream}`, borderRadius: "50%", left: 10, top: 10}} />
      <div style={{position: "absolute", width: 17, height: 6, borderRadius: 4, background: colors.cream, right: 5, bottom: 9, transform: "rotate(-36deg)"}} />
    </div>
    <div style={{fontFamily: "Avenir Next, Arial, sans-serif", fontWeight: 800, fontSize: 35, letterSpacing: -1.2, color: colors.cream}}>Bright Ears</div>
  </div>
);

const SceneCard: React.FC<{scene: RenderScene; index: number; total: number}> = ({scene, index, total}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 18, stiffness: 120, mass: 0.8}});
  const exit = interpolate(frame, [scene.durationInFrames - 18, scene.durationInFrames], [1, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
  const opacity = enter * exit;
  const lift = interpolate(enter, [0, 1], [46, 0]);

  return (
    <AbsoluteFill style={{background: colors.night, color: colors.cream, overflow: "hidden", fontFamily: "Avenir Next, Arial, sans-serif"}}>
      <div style={{position: "absolute", width: 760, height: 760, borderRadius: "50%", background: colors.coral, opacity: 0.16, right: -220, top: -330}} />
      <div style={{position: "absolute", width: 520, height: 520, borderRadius: "50%", background: colors.mint, opacity: 0.12, left: -190, bottom: -280}} />
      <div style={{position: "absolute", inset: "72px 92px", display: "flex", flexDirection: "column"}}>
        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
          <BrandMark />
          <div style={{fontSize: 24, letterSpacing: 1.5, color: "rgba(251,246,236,.7)"}}>TUTORIAL FACTORY · {String(index + 1).padStart(2, "0")}/{String(total).padStart(2, "0")}</div>
        </div>
        <div style={{flex: 1, display: "flex", alignItems: "center", transform: `translateY(${lift}px)`, opacity}}>
          <div style={{maxWidth: 1370}}>
            <div style={{fontWeight: 800, color: colors.gold, letterSpacing: 4, fontSize: 26, marginBottom: 26}}>{scene.eyebrow ?? "SAFE · REPEATABLE · REVIEWABLE"}</div>
            <h1 style={{fontSize: 94, lineHeight: 1.02, letterSpacing: -4.5, margin: 0, maxWidth: 1500}}>{scene.title}</h1>
            {scene.bullets.length > 0 ? (
              <div style={{display: "grid", gridTemplateColumns: scene.bullets.length > 2 ? "1fr 1fr" : "1fr", gap: "18px 42px", marginTop: 50, maxWidth: 1440}}>
                {scene.bullets.map((bullet, bulletIndex) => {
                  const bulletProgress = spring({frame: frame - 12 - bulletIndex * 5, fps, config: {damping: 20, stiffness: 135}});
                  return (
                    <div key={bullet} style={{display: "flex", gap: 18, fontSize: 34, lineHeight: 1.28, opacity: bulletProgress * exit, transform: `translateX(${interpolate(bulletProgress, [0, 1], [28, 0])}px)`}}>
                      <span style={{color: colors.coral, fontWeight: 900}}>●</span><span>{bullet}</span>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
        <div style={{height: 7, borderRadius: 8, background: "rgba(251,246,236,.12)", overflow: "hidden"}}>
          <div style={{height: "100%", width: `${Math.min(100, Math.max(0, frame / scene.durationInFrames * 100))}%`, background: colors.coral}} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const CaptureScene: React.FC<{scene: RenderScene; index: number; total: number}> = ({scene, index, total}) => {
  const frame = useCurrentFrame();
  if (!scene.mediaPath) throw new Error(`Capture scene ${scene.id} has no edited media path`);
  const fade = interpolate(
    frame,
    [0, 8, scene.durationInFrames - 8, scene.durationInFrames],
    [0, 1, 1, 0],
    {extrapolateLeft: "clamp", extrapolateRight: "clamp"},
  );
  return (
    <AbsoluteFill style={{background: colors.night, opacity: fade, fontFamily: "Avenir Next, Arial, sans-serif"}}>
      <OffthreadVideo src={staticFile(scene.mediaPath)} muted style={{width: "100%", height: "100%", objectFit: "cover"}} />
      <AbsoluteFill style={{boxShadow: `inset 0 0 0 14px ${colors.night}`, pointerEvents: "none"}} />
      <div style={{
        position: "absolute",
        right: 34,
        top: 28,
        width: 520,
        borderRadius: 20,
        padding: "18px 22px",
        color: colors.cream,
        background: "rgba(21,24,38,.92)",
        border: "1px solid rgba(251,246,236,.18)",
        boxShadow: "0 14px 40px rgba(0,0,0,.24)",
      }}>
        <div style={{display: "flex", justifyContent: "space-between", gap: 18, fontSize: 17, fontWeight: 800, letterSpacing: 2.1, color: colors.gold}}>
          <span>{scene.eyebrow ?? "BRIGHT EARS"}</span>
          <span>{String(index + 1).padStart(2, "0")}/{String(total).padStart(2, "0")}</span>
        </div>
        <div style={{fontSize: 28, lineHeight: 1.14, fontWeight: 800, marginTop: 8}}>{scene.title}</div>
      </div>
      <div style={{position: "absolute", left: 14, bottom: 14, right: 14, height: 6, background: "rgba(21,24,38,.25)"}}>
        <div style={{height: "100%", width: `${Math.min(100, Math.max(0, frame / scene.durationInFrames * 100))}%`, background: colors.coral}} />
      </div>
    </AbsoluteFill>
  );
};

export const Tutorial: React.FC<TutorialProps> = ({scenes}) => (
  <AbsoluteFill>
    {scenes.map((scene, index) => (
      <Sequence key={scene.id} from={scene.startFrame} durationInFrames={scene.durationInFrames} premountFor={30}>
        {scene.kind === "capture"
          ? <CaptureScene scene={scene} index={index} total={scenes.length} />
          : <SceneCard scene={scene} index={index} total={scenes.length} />}
      </Sequence>
    ))}
  </AbsoluteFill>
);
