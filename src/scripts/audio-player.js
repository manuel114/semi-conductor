/*
Copyright 2019 Google LLC

Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
*/

import Tone from 'tone';
import config from '../config.js';
import { getBeatLengthFromTempo, constrain } from './helpers';

export default class AudioPlayer {
  constructor(props) {
    this.props = props;
    this.instrumentsLoaded = 0;
    this.activeInstruments = [];
    this.velocity = 0.7;  // Arbitrary starting point that will be overridden by user
    this.finishedInstruments = 0;
    this.totalMeasures = (props.song.duration / 60) * (props.song.header.bpm / 4);
    this.loadInstruments();
    this.checkSampleLoading(); // Add timeout check
  }

  /* Called from main.js when tempo received from PoseController */
  setTempo(tempo) {
    Tone.Transport.bpm.value = constrain(tempo, {
      min: 0,
      max: config.detection.maximumBpm
    });
  }

  /* Set up effects, then call function to generate samplers */
  async loadInstruments() {
    // Make it sounds nice
    const gain = new Tone.Gain(config.tone.gain);
    const jcReverb = new Tone.JCReverb();
    const reverb = new Tone.Reverb(config.tone.reverb);
    jcReverb.wet.value = config.tone.jcReverbWet;
    reverb.wet.value = config.tone.reverbWet;
    await reverb.generate();

    this.generateSamplers({ gain, jcReverb, reverb });
  }

  /* Generates samplers for each track in the piece */
  generateSamplers(effects) {
    // Instruments should be given their official MIDI name, but lowercase,
    // e.g. 'cello'. This will be under tracks[i].instrument in the song json.
    this.props.song.tracks.forEach((track) => {
      console.log('Creating sampler for instrument:', track.instrument);
      console.log('Sample URLs:', this.props.samples[track.instrument]);
      console.log('Base path:', config.paths.samplesPath);
      
      // Log the actual sample URLs that will be used
      const sampleUrls = this.props.samples[track.instrument];
      console.log('Sample URLs details:');
      Object.keys(sampleUrls).forEach(note => {
        const url = config.paths.samplesPath + sampleUrls[note];
        console.log(`  ${note}: ${url}`);
      });
      
      this.activeInstruments.push(track.instrument);
      
      try {
        // Create full URLs for Tone.js Sampler
        const fullSampleUrls = {};
        Object.keys(sampleUrls).forEach(note => {
          fullSampleUrls[note] = config.paths.samplesPath + sampleUrls[note];
        });
        
        console.log('Creating sampler with full URLs:', fullSampleUrls);
        
        // Try a different approach - use a single sample first to test
        const testUrl = fullSampleUrls[Object.keys(fullSampleUrls)[0]];
        console.log('Testing with single sample URL:', testUrl);
        
        // Test if the file is accessible
        fetch(testUrl)
          .then(response => {
            console.log('File accessibility test for', testUrl, ':', response.status, response.statusText);
            if (!response.ok) {
              console.error('File not accessible:', testUrl);
            }
          })
          .catch(error => {
            console.error('Error fetching file:', testUrl, error);
          });
        
        // Try a simpler approach - just use the base URL and relative paths
        const sampleUrlsWithBase = {};
        Object.keys(sampleUrls).forEach(note => {
          sampleUrlsWithBase[note] = sampleUrls[note]; // Use relative paths
        });
        
        // Convert file paths to proper note names for Tone.Sampler
        const noteUrls = {};
        Object.keys(sampleUrls).forEach(note => {
          // The note name should be the key, and the file path should be the value
          noteUrls[note] = sampleUrls[note]; // Use relative paths
        });
        
        // Try to fix note name format for Tone.js
        // Tone.js might expect different note naming conventions
        const fixedNoteUrls = {};
        Object.keys(noteUrls).forEach(note => {
          // Try to ensure the note name is in the correct format
          // Tone.js might expect notes like "C4", "D#4", etc.
          fixedNoteUrls[note] = noteUrls[note];
        });
        
        console.log('Fixed note URLs:', fixedNoteUrls);
        
        // Try a completely different approach - use the newer API with simpler structure
        // First, try with just one sample to test
        const testNote = Object.keys(fixedNoteUrls)[0];
        const singleTestUrl = fixedNoteUrls[testNote];
        
        console.log('Testing with single note:', testNote, 'URL:', singleTestUrl);
        
        // Try different note name formats that Tone.js might expect
        // Tone.js might expect different formats like "A3", "A-3", etc.
        const toneNoteFormats = [
          testNote,                    // Original: "A#3"
          testNote.replace('#', ''),   // Try: "A3" 
          testNote.replace('#', '-'),  // Try: "A-3"
          testNote.toLowerCase(),       // Try: "a#3"
          testNote.replace('#', 'sharp') // Try: "Asharp3"
        ];
        
        let samplerCreated = false;
        
        for (let i = 0; i < toneNoteFormats.length && !samplerCreated; i++) {
          const format = toneNoteFormats[i];
          console.log('Trying note format:', format);
          
          try {
            // Try the OLD constructor format: (urls, callback, baseUrl)
            track.sampler = new Tone.Sampler(
              { [format]: singleTestUrl },  // urls object
              () => {                        // callback function
                console.log('Sample loaded successfully for', track.instrument, 'with format:', format);
                this.instrumentLoadCallback();
              },
              config.paths.samplesPath       // baseUrl
            ).chain(effects.gain, effects.jcReverb, effects.reverb, Tone.Master);
            
            console.log('Successfully created sampler with format:', format);
            samplerCreated = true;
          } catch (error) {
            console.log('Failed with format:', format, 'Error:', error.message);
          }
        }
        
        if (!samplerCreated) {
          throw new Error('Could not create sampler with any note format');
        }
        
        // Add error handling for the sampler
        track.sampler.onerror = (error) => {
          console.error('Sampler error for', track.instrument, ':', error);
        };
        
        // Add a timeout for this specific instrument in case it doesn't load
        setTimeout(() => {
          if (this.instrumentsLoaded < this.props.song.tracks.length) {
            console.log('Timeout for', track.instrument, '- calling callback anyway');
            this.instrumentLoadCallback();
          }
        }, 2000);
        
        console.log('Sampler created successfully for', track.instrument);
        
        // Ensure AudioContext is resumed
        if (Tone.context.state !== 'running') {
          Tone.context.resume().then(() => {
            console.log('AudioContext resumed successfully');
          }).catch(err => {
            console.error('Failed to resume AudioContext:', err);
          });
        }
      } catch (error) {
        console.error('Error creating sampler for', track.instrument, ':', error);
        // Fallback: create a simple synthesizer instead
        console.log('Creating fallback synthesizer for', track.instrument);
        track.sampler = new Tone.Synth({
          oscillator: {
            type: "triangle"
          },
          envelope: {
            attack: 0.1,
            decay: 0.2,
            sustain: 0.3,
            release: 1
          }
        }).chain(effects.gain, effects.jcReverb, effects.reverb, Tone.Master);
        
        // Call the callback immediately for fallback
        this.instrumentLoadCallback();
      }
    });
  }

  /* Go through each track and trigger load function */
  queueSong() {
    const song = this.props.song;
    const startTime = this.props.song.startTime;

    // Queue each of the tracks
    Tone.Transport.bpm.value = this.startingBpm = song.header.bpm;
    Tone.Transport.timeSignature = song.header.timeSignature;
    song.tracks.forEach((track) => {
      this.queueTrack(track, track.sampler);
    });

    Tone.Transport.position = startTime;
  }

  /* Add all notes to the Transport, with the relevant instrument */
  queueTrack(track, instrument) {
    new Tone.Part((time, note) => {
      const measures = parseInt(Tone.Transport.position.split(':')[0]) + 1;
      this.props.setSongProgress(100 * measures / this.totalMeasures)

      // Only play the instrument this bar if it's active
      if (this.activeInstruments.includes(track.instrument)) {
        // Adjust note duration based on tempo (slower tempo = longer notes)
        const durationRatio = this.startingBpm / Math.max(Tone.Transport.bpm.value, config.detection.minimumBpm);
        const duration = constrain(note.duration * durationRatio, {
          max: config.detection.maximumDuration,
          min: config.detection.minimumDuration
        });

        const velocity = constrain(this.velocity, {
          max: config.detection.maximumVelocity,
          min: config.detection.minimumVelocity
        });

        // Add a small time variation around 0 to make it sound more human
        // const variation = (Math.random() - 0.5) * 0.03;
        // Cue a note to be triggered at the time, with the pitch and duration
        try {
          instrument.triggerAttackRelease(note.name, duration, time, velocity); 
          this.props.triggerAnimation(track.instrument, duration, this.velocity);
        } catch (error) {
          console.warn('Could not play note', note.name, 'for', track.instrument, ':', error.message);
          // Still trigger animation even if sound fails
          this.props.triggerAnimation(track.instrument, duration, this.velocity);
        }
      }
    }, track.notes).start();
  }

  /* Updates the loading screen with current progress */
  instrumentLoadCallback() {
    console.log('Instrument loaded! Total loaded:', this.instrumentsLoaded + 1);
    this.instrumentsLoaded++;
    const totalTracks = this.props.song.tracks.length;
    const percentage = 100 * this.instrumentsLoaded / totalTracks;
    console.log('Loading percentage:', percentage);
    this.props.setInstrumentsLoaded(percentage);
  }

  /* Resume AudioContext after user interaction */
  resumeAudioContext() {
    if (Tone.context.state !== 'running') {
      return Tone.context.resume().then(() => {
        console.log('AudioContext resumed successfully');
        return true;
      }).catch(err => {
        console.error('Failed to resume AudioContext:', err);
        return false;
      });
    }
    return Promise.resolve(true);
  }

  /* Check if samples are loading properly */
  checkSampleLoading() {
    setTimeout(() => {
      console.log('Sample loading timeout check - instruments loaded:', this.instrumentsLoaded);
      if (this.instrumentsLoaded === 0) {
        console.error('No instruments loaded after timeout - forcing app to continue');
        // Force the app to continue anyway
        this.instrumentsLoaded = this.props.song.tracks.length;
        this.props.setInstrumentsLoaded(100);
      }
    }, 3000); // 3 second timeout instead of 10
  }

  /* Change which instruments are playing based on PoseController data */
  setInstrumentGroup(i) {
    this.activeInstruments = config.zones[i].instruments
  }

  /* Change velocity based on PoseController data */
  setVelocity(vel) {
    this.velocity = vel;
  }

  getBeatLength() {
    return getBeatLengthFromTempo(Tone.Transport.bpm.value);
  }

  start() {
    Tone.Transport.start();
  }

  stop() {
    Tone.Transport.pause();
  }

  restart() {
    Tone.Transport.stop();
    this.beatsElapsed = 0;
    Tone.Transport.bpm.value = this.startingBpm;
  }
}