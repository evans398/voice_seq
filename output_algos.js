// MAX OBJECT
autowatch = 1;
inlets = 1;
outlets = 11;

// ALGO ENUMS
const Algorithm = {
  PROBABILITY: 4,
  CYCLE: 2,
  WEIGHTED_SEQ: 0,
  AVOID_HISTORY: 5,
  RANDOM_SEQ: 1,
  CYCLE_REPEAT: 3,
  NONE: 6
};

// GENERAL PARAMS
const numVoices = 10;
let selectedAlgorithm = Algorithm.WEIGHTED_SEQ;
let behaviorMode = 0; // 0 = forward, 1 = backward, 2 = ping-pong, 3 = random (only for stepRepeat)
let sequenceLength = 16;
let activeChannels = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
let filteredActiveChannels = []
let fixedDurations = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
let octaveTranspose = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
let probabilitiesList = [0.2, 0.2, 0.2, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
let noteOnList = new Array(128).fill(-1); // each entry index is the MIDI note. The value is the channel that currently has the Note On. Value -1 if note off.
let recentHistory = [];
const historyLimit = 5;

// RR PARAMS
let roundRobinIndex = 0;
let roundRobinDirection = 1;

// WEIGHTED RR PARAMS
let masterWeightedRoundRobinSeq = []; // master list is full 32 steps
let weightedRoundRobinSeq = []; // this is the specified length cut from master
let weightedRoundRobinIndex = 0;
let roundRobinWeightsList = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
let weightedRoundRobinDirection = 1;

// RANDOM SEQUENCE PARAMS
let masterRandomSequence = []; // master list is full 32 steps
let randomSequence = []; // this is the specified length cut from master
let randomSequenceIndex = 0;
let randomSequenceDirection = 1;

// STEP REPEAT PARAMS
let stepRepeatChannelIndex = 0;
let stepRepeatCounter = 0;
let stepRepeatDirection = 1;
let stepRepeatList = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1];


/////// ------------- NOTE RECEIVED METHODS ------------- ///////
function note() {
  const args = arrayfromargs(arguments);
  if (args.length !== 3) {
    return;
  }
  const basePitch = args[0];
  const velocity = args[1];
  const durationOrig = args[2];

  // If velocity is 0 its a note off message
  if (velocity === 0){
    noteOff(basePitch);
	return;
  }

  // If all channels are off, just return here
  if (filteredActiveChannels.length === 0) {
    return;
  }
  
  // This makes note_off wonky. Think about it.
  if (selectedAlgorithm === Algorithm.NONE) {
    outlet(10, [basePitch, velocity, 0]);
    noteOnList[basePitch] = 10;
    return;
  }

  // Find which channel to route this note. only one channel should own a note
  const ch = getChannel(filteredActiveChannels);
  if (ch === null) {
    return;
  }
  
  const duration = fixedDurations[ch];

    // Track which channel has note on (0–127)
  // If the duration is 0, it means we need to track which channel the note is pushed to so we can send the note off
  // when it is received. We track basePitch If we have duration, note off will be handled post-script by makenote object.
  if (duration === 0) {
    noteOnList[basePitch] = ch;
  }

  const pitch = Math.min(127, Math.max(0, basePitch + (octaveTranspose[ch] * 12)));
  

  recentHistory.push(ch);
  if (recentHistory.length > historyLimit) {
    recentHistory.shift();
  }

  // Send note-on (use duration or 0 depending on your downstream convention)
  outlet(ch, [pitch, velocity, duration]);
}

// Called when velocity is 0
function noteOff(basePitch){
	// Find which channel owns this pitch
    var ch = noteOnList[basePitch];
    const pitch = Math.min(127, Math.max(0, basePitch + (octaveTranspose[ch] * 12)));

    if (ch === -1) {
        return; // nothing to turn off
    }
	outlet(ch, [pitch, 0, 0]);
	noteOnList[pitch] = -1;
}


/////// ------------- INTERFACE METHODS ------------- ///////
// called when a channel is turned off or on
function active() {
  // Convert the function's `arguments` into a real JS array.
  // For each item (n), output 1 if it is truthy, otherwise output 0.
  const args = arrayfromargs(arguments).map(function (n) { return n ? 1 : 0; });
  activeChannels = args;

  // Build a new array of only the indices of active channels
  filteredActiveChannels = activeChannels.map(function (v, i) {
    return v ? i : -1;
  }).filter(function (i) {
    return i !== -1;
  });
  rebuildWeightedSequence();
  rebuildRandomSequence();
}

// called when an algorithm is selected
function algorithm(index) {
  selectedAlgorithm = parseInt(index);
  if (selectedAlgorithm === Algorithm.WEIGHTED_SEQ) {
    // post("WRR ALGO SELECTED");
    rebuildWeightedSequence();
  } else if (selectedAlgorithm === Algorithm.RANDOM_SEQ) {
    rebuildRandomSequence();
  }

  // only reset random behavior when algo is neither CYCLE nor CYCLE_REPEAT
  if (behaviorMode === 3 && (selectedAlgorithm !== Algorithm.CYCLE && selectedAlgorithm !== Algorithm.CYCLE_REPEAT)) {
    behaviorMode = 0;
  }
}

// called when sequence direction behavior is modified
function behavior(mode) {
  behaviorMode = parseInt(mode);
}

// called when probability sliders are modified
function probabilities() {
  const args = arrayfromargs(arguments).map(Number);
  if (args.length !== numVoices) {
    return;
  }
  const sum = args.reduce(function (a, b) { return a + b; }, 0);
  if (sum <= 0) {
    return;
  }
  probabilitiesList = args.map(function (p) { return p / sum; });
}

// called when round robin sliders are modified
function roundRobinWeights() {
  const args = arrayfromargs(arguments).map(Number);
  // post("WRR SLIDERS MOD");
  if (args.length === numVoices) {
    roundRobinWeightsList = args;
    rebuildWeightedSequence();
  }
}

// called when step repeat sliders are modified
function stepRepeat() {
  const args = arrayfromargs(arguments).map(Number);
  if (args.length === numVoices) {
    stepRepeatList = args.map(function (val) {
      return Math.max(1, Math.ceil(val * 10));
    });
  }
}

// called when transpose amount on any channel is modified
function transpose() {
  const args = arrayfromargs(arguments).map(function (n) { return parseInt(n); });
  if (args.length === numVoices) {
    // octaveTranspose = args;
     // find the value that changed and turn off notes on that channel
    for (var i = 0; i < numVoices; i = i + 1) {
        if (args[i] !== octaveTranspose[i]) {
            turnOffNotes(i);
            octaveTranspose = args;
            return;
        }
    }
  }
}

function turnOffNotes(ch) {
    // cycle through noteOnList and if the value at the index (MIDI pitch number) is equal to the channel, turn the note off. 
    for (var i = 0; i < noteOnList.length; i = i + 1) {
        outlet(ch, [i, 0, 0]);
        noteOnList[i] = -1;
    }
}

// called when duration multiplier on any channel is modified
function durations() {
  const args = arrayfromargs(arguments).map(function (n) { return parseFloat(n); });
  if (args.length === numVoices) {
    fixedDurations = args;
  }
}

// called when wrr/rand seq length is modified
function setSequenceLength(len) {
  const parsed = parseInt(len);
  if (!isNaN(parsed) && parsed > 0) {
    sequenceLength = parsed;
    updateWeightedPlaybackSequence();
    updateRandomPlaybackSequence();
  }
  if (selectedAlgorithm === Algorithm.WEIGHTED_SEQ) {
    // post("WRR SEQ: " + weightedRoundRobinSeq.join(" ") + "\n");
  } else if (selectedAlgorithm === Algorithm.RANDOM_SEQ) {
    //post("RAND SEQ: " + randomSequence.join(" ") + "\n");
  }
}

// called when regen seq button is pressed
function regen() {
  if (selectedAlgorithm === Algorithm.WEIGHTED_SEQ) {
    rebuildWeightedSequence();
  } else if (selectedAlgorithm === Algorithm.RANDOM_SEQ) {
    rebuildRandomSequence();
  }
}


/////// ------------- ALGORITHM METHODS ------------- ///////
function getChannel(active) {
  switch (selectedAlgorithm) {
    case Algorithm.PROBABILITY:
      return pickByProbability(active);
    case Algorithm.CYCLE:
      return getNextRoundRobin(active);
    case Algorithm.WEIGHTED_SEQ:
      return getNextWeightedRoundRobin(active);
    case Algorithm.AVOID_HISTORY:
      return avoidRecentHistory(active);
    case Algorithm.RANDOM_SEQ:
      return getNextRandomSequence(active);
    case Algorithm.CYCLE_REPEAT:
      return getNextStepRepeatChannel(active);
    case Algorithm.NONE:
        return active.length ? active[0] : null; // first active (zero-based);
    default:
      return pickByProbability(active);
  }
}

// THIS CAN BE A PREDEFINED SEQUENCE THAT REFRESHES PERIODICALLY OR WHEN A PROBABILITY CHANGES
function pickByProbability(active) {
  const filteredProbs = active.map(function (i) { return probabilitiesList[i]; });
  const sum = filteredProbs.reduce(function (a, b) { return a + b; }, 0);
  const normProbs = filteredProbs.map(function (p) { return p / sum; });
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < normProbs.length; i++) {
    acc += normProbs[i];
    if (r < acc) {
      return active[i];
    }
  }
  return active[active.length - 1];
}

// THIS ALSO CAN BE PREDEFINED LIST THAT ONLY CHANGES WHEN BEHAVIOR MODE CHANGES

function getNextRoundRobin(active) {
  var len = active.length;
  if (len === 0) {
    return null;
  }

  // Clamp index if active set changed
  if (roundRobinIndex >= len) {
    roundRobinIndex = 0;
  }

  // Use current channel, then compute the next index
  var ch = active[roundRobinIndex];

  if (behaviorMode === 0) {
    // forward
    roundRobinIndex = (roundRobinIndex + 1) % len;
  } 
  else if (behaviorMode === 1) {
    // backward
    roundRobinIndex = (roundRobinIndex - 1 + len) % len;
  } 
  else if (behaviorMode === 2) {
    // ping-pong
    if (roundRobinDirection === 1 && roundRobinIndex === len - 1) {
      roundRobinDirection = -1;
    } 
    else if (roundRobinDirection === -1 && roundRobinIndex === 0) {
      roundRobinDirection = 1;
    }
    roundRobinIndex = roundRobinIndex + roundRobinDirection;
  } 
  else if (behaviorMode === 3) {
    // random, repeats allowed
    roundRobinIndex = Math.floor(Math.random() * len);
  }

  return ch;
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
}

function rebuildWeightedSequence() {
  masterWeightedRoundRobinSeq = [];
  for (let i = 0; i < roundRobinWeightsList.length; i++) {
    if (activeChannels[i] && roundRobinWeightsList[i] > 0) {
      const count = Math.round(roundRobinWeightsList[i] * 10);
      for (let j = 0; j < count; j++) {
        masterWeightedRoundRobinSeq.push(i);
      }
    }
  }

  shuffleArray(masterWeightedRoundRobinSeq);
  masterWeightedRoundRobinSeq = masterWeightedRoundRobinSeq.slice(0, 32); // Always 32 steps
  // post("WRR Master: " + masterWeightedRoundRobinSeq.join(" ") + "\n");
  updateWeightedPlaybackSequence();
}

function updateWeightedPlaybackSequence() {
  weightedRoundRobinSeq = masterWeightedRoundRobinSeq.slice(0, sequenceLength);
  weightedRoundRobinIndex = 0;
  weightedRoundRobinDirection = 1;
}

function getNextWeightedRoundRobin(active) {
  if (weightedRoundRobinSeq.length === 0) {
    rebuildWeightedSequence();
  }

  var len = weightedRoundRobinSeq.length;
  for (var i = 0; i < len; i++) {
    var candidate = weightedRoundRobinSeq[weightedRoundRobinIndex];

    // Advance index — only modes 0–2 are honored. Mode 3 is treated as 0 (forward).
    if (behaviorMode === 0 || behaviorMode === 3) {
      weightedRoundRobinIndex = (weightedRoundRobinIndex + 1) % len;
    } else if (behaviorMode === 1) {
      weightedRoundRobinIndex = (weightedRoundRobinIndex - 1 + len) % len;
    } else if (behaviorMode === 2) {
      if (weightedRoundRobinDirection === 1 && weightedRoundRobinIndex === len - 1) {
        weightedRoundRobinDirection = -1;
      } else if (weightedRoundRobinDirection === -1 && weightedRoundRobinIndex === 0) {
        weightedRoundRobinDirection = 1;
      }
      weightedRoundRobinIndex = weightedRoundRobinIndex + weightedRoundRobinDirection;
    }

    if (active.includes(candidate)) {
      return candidate;
    }
  }

  return active[0];
}

function rebuildRandomSequence() {
  const active = activeChannels.map(function (v, i) {
    return v ? i : -1;
  }).filter(function (i) {
    return i !== -1;
  });

  masterRandomSequence = [];
  for (let i = 0; i < 32; i++) {
    const rand = Math.floor(Math.random() * active.length);
    masterRandomSequence.push(active[rand]);
  }

  // post("RAND Master: " + masterRandomSequence.join(" ") + "\n");
  updateRandomPlaybackSequence();
}

function updateRandomPlaybackSequence() {
  randomSequence = masterRandomSequence.slice(0, sequenceLength);
  randomSequenceIndex = 0;
  randomSequenceDirection = 1;
}

function getNextRandomSequence(active) {
  if (randomSequence.length === 0) {
    rebuildRandomSequence();
  }

  const len = randomSequence.length;
  const candidate = randomSequence[randomSequenceIndex];

  if (behaviorMode === 0) {
    randomSequenceIndex = (randomSequenceIndex + 1) % len;
  } else if (behaviorMode === 1) {
    randomSequenceIndex = (randomSequenceIndex - 1 + len) % len;
  } else if (behaviorMode === 2) {
    if (randomSequenceDirection === 1 && randomSequenceIndex === len - 1) {
      randomSequenceDirection = -1;
    } else if (randomSequenceDirection === -1 && randomSequenceIndex === 0) {
      randomSequenceDirection = 1;
    }
    randomSequenceIndex += randomSequenceDirection;
  }

  if (active.includes(candidate)) {
    return candidate;
  }

  return active[0];
}

function avoidRecentHistory(active) {
  const scores = active.map(function (ch) {
    const recentCount = recentHistory.filter(function (h) { return h === ch; }).length;
    return { ch: ch, weight: 1 / (1 + recentCount) };
  });

  const total = scores.reduce(function (sum, s) { return sum + s.weight; }, 0);
  const r = Math.random() * total;
  let acc = 0;

  for (let i = 0; i < scores.length; i++) {
    acc += scores[i].weight;
    if (r < acc) {
      return scores[i].ch;
    }
  }

  return scores[scores.length - 1].ch;
}

function getNextStepRepeatChannel(active) {
  const numChannels = active.length;

  if (stepRepeatCounter < stepRepeatList[active[stepRepeatChannelIndex]]) {
    stepRepeatCounter++;
    return active[stepRepeatChannelIndex];
  }

  stepRepeatCounter = 1;

  if (behaviorMode === 0) {
    stepRepeatChannelIndex = (stepRepeatChannelIndex + 1) % numChannels;
  } else if (behaviorMode === 1) {
    stepRepeatChannelIndex = (stepRepeatChannelIndex - 1 + numChannels) % numChannels;
  } else if (behaviorMode === 2) {
    if (stepRepeatDirection === 1 && stepRepeatChannelIndex === numChannels - 1) {
      stepRepeatDirection = -1;
    } else if (stepRepeatDirection === -1 && stepRepeatChannelIndex === 0) {
      stepRepeatDirection = 1;
    }
    stepRepeatChannelIndex += stepRepeatDirection;
  } else if (behaviorMode === 3) {
    let next;
    do {
      next = Math.floor(Math.random() * numChannels);
    } while (next === stepRepeatChannelIndex && numChannels > 1);
    stepRepeatChannelIndex = next;
  }

  return active[stepRepeatChannelIndex];
}

// ----------- INITIALIZE -----------
function loadbang(){
  filteredActiveChannels = activeChannels
    .map(function (v, i) { return v ? i : -1; })
    .filter(function (i) { return i !== -1; });

  rebuildWeightedSequence();
  rebuildRandomSequence();
}