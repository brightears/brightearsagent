import React from "react";
import {Composition} from "remotion";
import {Tutorial, type TutorialProps} from "./tutorial";

const defaultProps: TutorialProps = {
  title: "Bright Ears Tutorial",
  scenes: [{id: "default", kind: "synthetic", title: "Safe by design", eyebrow: "BRIGHT EARS", bullets: [], startFrame: 0, durationInFrames: 150}],
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Tutorial"
    component={Tutorial}
    width={1920}
    height={1080}
    fps={30}
    durationInFrames={150}
    defaultProps={defaultProps}
    calculateMetadata={({props}) => ({durationInFrames: props.scenes.reduce((sum, scene) => sum + scene.durationInFrames, 0)})}
  />
);
