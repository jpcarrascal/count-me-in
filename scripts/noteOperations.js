noteFrequencies = [8.18, 8.66, 9.18, 9.72, 10.3, 10.91, 11.56, 12.25, 12.98, 13.75,
                14.57, 15.43, 16.35, 17.32, 18.35, 19.45, 20.6, 21.83, 23.12, 24.5,
                25.96, 27.5, 29.14, 30.87, 32.7, 34.65, 36.71, 38.89, 41.2, 43.65,
                46.25, 49, 51.91, 55, 58.27, 61.74, 65.41, 69.3, 73.42, 77.78, 82.41,
                87.31, 92.5, 98, 103.83, 110, 116.54, 123.47, 130.81, 138.59, 146.83,
                155.56, 164.81, 174.61, 185, 196, 207.65, 220, 233.08, 246.94, 261.63,
                277.18, 293.66, 311.13, 329.63, 349.23, 369.99, 392, 415.3, 440, 466.16,
                493.88, 523.25, 554.37, 587.33, 622.25, 659.26, 698.46, 739.99, 783.99,
                830.61, 880, 932.33, 987.77, 1046.5, 1108.73, 1174.66, 1244.51, 1318.51,
                1396.91, 1479.98, 1567.98, 1661.22, 1760, 1864.66, 1975.53, 2093, 2217.46,
                2349.32, 2489.02, 2637.02, 2793.83, 2959.96, 3135.96, 3322.44, 3520, 3729.31,
                3951.07, 4186.01, 4434.92, 4698.64, 4978.03, 5274.04, 5587.65, 5919.91, 6271.93,
                6644.88, 7040, 7458.62, 7902.13, 8372.02, 8869.84, 9397.27, 9956.06, 10548.08,
                11175.3, 11839.82, 12543.85];

const scales = {
    C_major: [0, 2, 4, 5, 7, 9, 11],
    C_sharp_major: [1, 3, 5, 6, 8, 10, 0],
    D_major: [2, 4, 6, 7, 9, 11, 1],
    E_flat_major: [3, 5, 7, 8, 10, 0, 2],
    E_major: [4, 6, 8, 9, 11, 1, 3],
    F_major: [5, 7, 9, 10, 0, 2, 4],
    F_sharp_major: [6, 8, 10, 11, 1, 3, 5],
    G_major: [7, 9, 11, 0, 2, 4, 6],
    A_flat_major: [8, 10, 0, 1, 3, 5, 7],
    A_major: [9, 11, 1, 2, 4, 6, 8],
    B_flat_major: [10, 0, 2, 3, 5, 7, 9],
    B_major: [11, 1, 3, 4, 6, 8, 10],
    
    A_minor: [0, 2, 3, 5, 7, 8, 10],
    B_flat_minor: [1, 3, 4, 6, 8, 9, 11],
    B_minor: [2, 4, 5, 7, 9, 10, 0],
    C_minor: [3, 5, 6, 8, 10, 11, 1],
    C_sharp_minor: [4, 6, 7, 9, 11, 0, 2],
    D_minor: [5, 7, 8, 10, 0, 1, 3],
    E_flat_minor: [6, 8, 9, 11, 1, 2, 4],
    E_minor: [7, 9, 10, 0, 2, 3, 5],
    F_minor: [8, 10, 11, 1, 3, 4, 6],
    F_sharp_minor: [9, 11, 0, 2, 4, 5, 7],
    G_minor: [10, 0, 1, 3, 5, 6, 8],
    A_flat_minor: [11, 1, 2, 4, 6, 7, 9],
};

function determineTonality(melody) {

    const noteCounts = new Array(12).fill(0);

    // Count the occurrences of each note in the melody
    melody.forEach(note => {
        const pitchClass = note % 12;
        noteCounts[pitchClass]++;
    });

    let bestMatch = null;
    let bestMatchScore = -1;

    // Compare the melody to each scale
    for (const [scaleName, scaleNotes] of Object.entries(scales)) {
        let score = 0;

        scaleNotes.forEach(note => {
            score += noteCounts[note];
        });

        if (score > bestMatchScore) {
            bestMatchScore = score;
            bestMatch = scaleName;
        }
    }

    return bestMatch;
}

function transposeMelody(melody, fromScale, toScale) {
    console.log(fromScale)
    const fromScaleNotes = scales[fromScale];
    const toScaleNotes = scales[toScale];

    if (!fromScaleNotes || !toScaleNotes) {
        throw new Error('Invalid scale name');
    }

    const transposedMelody = melody.map(note => {
        const pitchClass = note % 12;
        const octave = Math.floor(note / 12);
        const noteIndex = fromScaleNotes.indexOf(pitchClass);

        if (noteIndex === -1) {
            throw new Error(`Note ${note} is not in the ${fromScale} scale`);
        }

        const transposedPitchClass = toScaleNotes[noteIndex];
        return transposedPitchClass + (octave * 12);
    });

    return transposedMelody;
}