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

import * as PIXI from 'pixi.js';
import instruments from '../assets/gui-instruments.js';

// Width of stage = 1288px

export default class Orchestra {
  constructor(props) {
    this.props = props;
    this.texturesPath = this.props.texturesPath;

    this.maxWidth = 1400;
    this.maxHeight = 670;

    this.instruments = instruments;

    // BEGIN CUSTOM ROSALYN THEMING
    this.gtmAlignment = {
      sales: { aligned: false, startTime: null },
      marketing: { aligned: false, startTime: null },
      customerSuccess: { aligned: false, startTime: null },
      forecasting: { aligned: false, startTime: null },
      dataIntegration: { aligned: false, startTime: null }
    };
    this.conductingStartTime = null;
    // END CUSTOM ROSALYN THEMING

    const app = new PIXI.Application({
      width: this.maxWidth,
      height: this.maxHeight,
      transparent: true
    });

    this.offset = { x: -30, y: -160 }

    app.renderer.autoResize = true;
    app.renderer.view.style.maxWidth = 1000 + 'px';

    const container = document.querySelector('.orchestra');
    container.appendChild(app.view);

    this.container = container;
    this.app = app;
    PIXI.loader.add(this.texturesPath).load(this.setup.bind(this));
  }

  /* Set up for the stage */
  setup() {
    this.props.loaded();
    const textures = PIXI.loader.resources[this.texturesPath].textures;

    // Set up stage
    const stage = new PIXI.Sprite(textures['stage']);
    stage.y = (this.maxHeight - stage.height) / 2;
    stage.x = (this.maxWidth - stage.width) / 2;
    this.app.stage.addChild(stage);

    // BEGIN CUSTOM ROSALYN THEMING
    // Add GTM process labels as HTML overlays
    this.addGTMLabels();
    // END CUSTOM ROSALYN THEMING

    // Set up instruments
    Object.keys(this.instruments).forEach((name) => {
      this.instruments[name].objects.forEach((inst) => {
        inst.x0 += this.offset.x;
        inst.y0 += this.offset.y;

        inst.sprite = new PIXI.Sprite(textures[name]);
        inst.bow.sprite = new PIXI.Sprite(textures[name + 'Bow']);

        inst.bow.sprite.anchor.set(0.5, 0.5);
        inst.bow.sprite.x = inst.bow.x0;
        inst.bow.sprite.y = inst.bow.y0;
        inst.bow.sprite.rotation = inst.bow.rotation0;
        
        inst.sprite.addChild(inst.bow.sprite);

        inst.sprite.anchor.set(0.5, 0.5);
        inst.sprite.x = inst.x0;
        inst.sprite.y = inst.y0
        inst.sprite.rotation = inst.rotation0;

        // BEGIN CUSTOM ROSALYN THEMING
        // Add initial misalignment for GTM team effect
        inst.originalRotation = inst.rotation0;
        inst.originalX = inst.x0;
        inst.originalY = inst.y0;
        
        // Randomly misalign instruments initially
        const misalignment = (Math.random() - 0.5) * 0.3; // ±0.15 radians
        inst.sprite.rotation = inst.rotation0 + misalignment;
        inst.sprite.x = inst.x0 + (Math.random() - 0.5) * 20; // ±10px
        inst.sprite.y = inst.y0 + (Math.random() - 0.5) * 15; // ±7.5px
        // END CUSTOM ROSALYN THEMING

        stage.addChild(inst.sprite);
      });
    });

    // Adapt resolution to screen
    this.app.renderer.view.style.width = "100%";
    this.loop();
  }

  /* For each frame, do this animation (animate any triggered insts) */
  loop() {
    Object.keys(this.instruments).forEach((name) => {
      const animation = this.instruments[name].animation;
      if (animation.triggered) {
        this.instruments[name].objects.forEach((inst) => {
          const sinArgument = (1 / animation.duration) * 2 * Math.PI * (Date.now() - animation.startTime) / 1000;
          inst.bow.sprite.x = inst.bow.x0 + 10 * Math.sin(sinArgument);
          inst.sprite.rotation = inst.rotation0 + 0.025 * Math.sin(sinArgument);
          inst.sprite.y = inst.y0 - 10 * this.velocity * (1 + Math.sin(0.5 * sinArgument));
        });
      }
    })

    // BEGIN CUSTOM ROSALYN THEMING
    // Gradually align instruments as conducting becomes smoother
    this.updateGTMAlignment();
    // END CUSTOM ROSALYN THEMING

    requestAnimationFrame(this.loop.bind(this));
  }

  /* Called when a note is triggered for an instrument */
  trigger(instrument, duration, velocity) {
    const inst = this.instruments[instrument];
    if (inst.animation.timeout) clearTimeout(inst.animation.timeout);
    inst.animation.triggered = true;
    inst.animation.startTime = Date.now();
    inst.animation.duration = duration;
    this.velocity = velocity;

    // BEGIN CUSTOM ROSALYN THEMING
    // Track when conducting starts for alignment timing
    if (!this.conductingStartTime) {
      this.conductingStartTime = Date.now();
    }
    // END CUSTOM ROSALYN THEMING

    inst.animation.timeout = setTimeout(() => {
      inst.animation.triggered = false;
      clearTimeout(inst.animation.timeout);
    }, duration * 1000);
  }

  // BEGIN CUSTOM ROSALYN THEMING
  updateGTMAlignment() {
    if (!this.conductingStartTime) return;
    
    const conductingDuration = (Date.now() - this.conductingStartTime) / 1000;
    
    // Gradually align instruments over time as conducting continues
    Object.keys(this.instruments).forEach((name) => {
      this.instruments[name].objects.forEach((inst) => {
        // Calculate alignment progress (0 to 1) over 30 seconds
        const alignmentProgress = Math.min(conductingDuration / 30, 1);
        
        // Smoothly interpolate back to original position
        const targetRotation = inst.originalRotation;
        const targetX = inst.originalX;
        const targetY = inst.originalY;
        
        // Use easing function for smooth transition
        const easeProgress = this.easeInOutCubic(alignmentProgress);
        
        inst.sprite.rotation = inst.sprite.rotation + (targetRotation - inst.sprite.rotation) * 0.02;
        inst.sprite.x = inst.sprite.x + (targetX - inst.sprite.x) * 0.02;
        inst.sprite.y = inst.sprite.y + (targetY - inst.sprite.y) * 0.02;
      });
    });
  }

  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
  }

  // BEGIN CUSTOM ROSALYN THEMING
  addGTMLabels() {
    // Define GTM process labels as HTML overlays
    const gtmLabels = [
      {
        text: "Sales Cadence",
        position: "left"
      },
      {
        text: "Forecast Engine",
        position: "top"
      },
      {
        text: "CS Insights",
        position: "right"
      },
      {
        text: "Marketing Signals",
        position: "bottom-right"
      }
    ];

    // Create elegant HTML labels
    gtmLabels.forEach((label) => {
      const labelDiv = document.createElement('div');
      labelDiv.className = 'gtm-label';
      labelDiv.textContent = label.text;
      labelDiv.style.cssText = `
        position: absolute;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 8px 16px;
        border: 2px solid #FF8976;
        border-radius: 8px;
        font-family: 'Georgia', serif;
        font-size: 12px;
        font-weight: bold;
        white-space: nowrap;
        z-index: 1000;
        pointer-events: none;
      `;

      // Position based on label type
      switch(label.position) {
        case 'left':
          labelDiv.style.left = '12%';
          labelDiv.style.top = '50%';
          labelDiv.style.transform = 'translateY(-50%)';
          break;
        case 'top':
          labelDiv.style.left = '30%';
          labelDiv.style.top = '20%';
          break;
        case 'right':
          labelDiv.style.left = '60%';
          labelDiv.style.top = '18%';
          break;
        case 'bottom-right':
          labelDiv.style.left = '80%';
          labelDiv.style.top = '50%';
          break;
      }

      // Add to the orchestra container
      this.container.appendChild(labelDiv);
    });
  }
  // END CUSTOM ROSALYN THEMING
}