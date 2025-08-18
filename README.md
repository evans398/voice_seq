# voice_seq

This is a Max for Live device that allows you to route incoming MIDI notes to 10 different voices according to 6 algorithms. This device is born out of a system that I originally built for a live multi-organ performance at Palau Güell in Barcelona and later expanded for a performance at +RAIN festival. This system incorportated a MIDI instrument performance, Markov Model, rhythm generator, and voice sequencer. The Markov Model was trained in real-time by the MIDI performance. The rhythm generator was conditioned in real-time by the same performance and generated an acompanying rhythm. This generated rhythm would trigger the Markov model to send a note out. Essentially, we were assigning pitch to a generated rhythmic accompaniment condition by a performer. Finally, these generated notes were sent to the voice sequencer and assigned to different output instruments. The +RAIN performance included a spatial audio component via a custom Spat patch developed according to the venue's sound system. A NIME paper for the multi-organ performance can be found here: https://nime2025.org/proceedings/55.html

<img width="597" height="196" alt="Screenshot 2025-08-18 at 6 52 05 PM" src="https://github.com/user-attachments/assets/23f6ed09-a987-4c61-b473-a3c4563a4231" />

## Set-up

1. Place the device on a MIDI track. Route the MIDI that you want to sequence to multiple voices to this track. This can be a MIDI clip, input from a MIDI instrument, etc.
2. On the tracks that correspond to the voices you want to route MIDI to, place the voice_seq Receiver device. This device consists of 10 buttons which correspond to which voice_seq channels this track will receive.

<img width="104" height="196" alt="Screenshot 2025-08-18 at 7 13 14 PM" src="https://github.com/user-attachments/assets/9dabe069-2239-44ec-b426-d69857299a21" />

## Algorithms
1. Weighted Seq - This algortihm builds a voice sequence according to the active channels, the weights (slider values) assigned to each channel, and the defined sequence length. The sequence is regenerated anytime an adjustment is made to a weight, a channel is turned on or off, or when the regen button is pressed. The direction of this sequence can be defined by the directional buttons below the algorithm selections.

2. Random Seq - This algorithm generates a random sequence of channels that are currently active. Essentially, this algorithm is equivalent to a Weighted Sequence in which every channel has the same weights. The sequnce is regenerated anytime a channel is turned on or off, or when the regen button is pressed. The direction of this sequence can be defined by the directional buttons below the algorithm selections.

3. Cycle - This algorithm simply cycles through each active channel in order and according to the selected direction. This algorithm can also use the "random direction" which randomly selects an active channel.

4. Cycle Repeat - This algorithm is the same as "Cycle", but the sliders define how many MIDI notes each channel should receive before moving the sequence moves on.

5. Probability - This algorithm selects an active channel based on the probability weights (slider values) assigned to each channel. For example, two active channels with equal weights will result in ~50/50 note distribution. If three channels are active with respective weights 6, 3, 3, channel 1 will receive ~50% of the notes while channels 2 and 3 receive ~25%.

6. Avoid Recent - This algorithm randomly selects an active channel with a bias against selected a recently selected channel.

## Note Transform
Each channel has two setting to transform the notes its receives:

1. Octave Transpose: This value determines how many octaves up or down (-4 to +4) each incoming note is transposed.
   
2. Fixed Duration: When a channel receives a note on, it will play until a note off message is received. However, this setting allows a specific duration (ranging from 1/64 notes to 4 whole notes) to be assigned to all incoming notes as soon as the note on message is received.

## Resets, Presets, Channel Names

"R" buttons next to weights, on/off, octave, and duration will reset each channel to the default. Preset box saves all weights, active channels, note transform values, algorithm selection, sequence, and sequence direction. The text at the top of each channel can be edited by the user to rename each channel.

## Tips

I still have a lot of creative exploration to do but I've found that using Ableton's Rotating Rhythm Generator or Arpeggiator can be nice for generating immediate results. Rapidly triggering notes with the arp and multiple channels can lead to some very cool textures. Try existing chord progressions or melodies composed for a single instrument and see how they sound with voice_seq. It pays off to spend a bit of time on the destination synths and overall mix especially if you're using a lot of active channels. Having some active channels with no destination instrument is a good way to add space, especially if you're using the arp or rhythm generator.

