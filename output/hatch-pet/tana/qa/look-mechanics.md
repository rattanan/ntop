# Tana look mechanics

Tana is a compact 3D-toy pangolin with a distinct face under a layered scale hood, a broad scaled torso, planted paws, and a heavy tapering tail. The most natural look motion is led by the physical eyeballs and snout, followed by a restrained head-and-neck turn and a small upper-torso response. The feet, lower torso, and tail root stay registered to the same baseline. The tail may lag by a small continuous amount, but it must remain attached and must never jump sides.

## Motion budget

Each 22.5-degree step moves the pupils, eyelids, snout, head, upper torso, and tail tip by a roughly even visual increment. Preserve the same head size, facial proportions, scale pattern, body volume, and planted baseline. Do not rotate or skew the whole sprite. Do not replace the eyes or slide detached pupils over fixed whites; redraw each complete eye surface with matching eyelid and highlight behavior. No props are present.

## Cardinal pose families

- **000 up:** pupils and eye globes rotate upward; eyelids open slightly upward; snout pitches up; chin and upper chest lift a little. Both body sides remain balanced, with lower paws and tail root fixed.
- **090 screen-right:** snout and pupils move unmistakably to screen-right of the head center; the right-facing cheek and outer scale hood become more visible while the far cheek and far eye become partly occluded. Upper torso yaws subtly right; tail tip lags slightly toward screen-left.
- **180 down:** pupils and eye globes rotate down; upper eyelids lower; snout dips toward the chest; head and upper torso compress slightly while feet, body width, and tail root remain fixed.
- **270 screen-left:** snout and pupils move unmistakably to screen-left of the head center; the left-facing cheek and outer scale hood become more visible while the far cheek and far eye become partly occluded. Upper torso yaws subtly left; tail tip lags slightly toward screen-right.

## Continuity and identity locks

Intermediates interpolate evenly between adjacent cardinal families. The 157.5-to-180 and 337.5-to-000 boundaries must be one ordinary step, without a scale pop, re-centering jump, eye replacement, tail flip, or identity change. All directions must remain visibly different from the neutral idle pose at normal pet size.
