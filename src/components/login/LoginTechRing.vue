<template>
  <div class="tech-ring">

    <svg
      viewBox="0 0 500 500"
      class="ring-svg"
      aria-hidden="true"
    >

      <defs>

        <linearGradient id="ringGradient"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="100%">

          <stop offset="0%" stop-color="#60A5FA"/>

          <stop offset="100%" stop-color="#BFDBFE"/>

        </linearGradient>

        <filter id="ringGlow">

          <feGaussianBlur
              stdDeviation="4"
              result="blur"/>

          <feMerge>

              <feMergeNode in="blur"/>

              <feMergeNode in="SourceGraphic"/>

          </feMerge>

        </filter>

      </defs>

      <!-- ÓRBITA EXTERIOR -->

      <g class="orbit orbit-1">

        <circle
            class="outer-ring"
            cx="250"
            cy="250"
            r="170"/>

        <circle cx="250" cy="80" r="5" class="node"/>

        <circle cx="420" cy="250" r="5" class="node"/>

        <circle cx="250" cy="420" r="5" class="node"/>

        <circle cx="80" cy="250" r="5" class="node"/>

      </g>

      <!-- ÓRBITA INTERNA -->

      <g class="orbit orbit-2">

        <circle
            class="inner-ring"
            cx="250"
            cy="250"
            r="140"/>

        <circle cx="250" cy="110" r="4" class="small-node"/>

        <circle cx="390" cy="250" r="4" class="small-node"/>

        <circle cx="250" cy="390" r="4" class="small-node"/>

        <circle cx="110" cy="250" r="4" class="small-node"/>

      </g>

      <!-- CONEXIONES -->

      <g class="connections">

        <line x1="250" y1="80"
              x2="250" y2="110"/>

        <line x1="420" y1="250"
              x2="390" y2="250"/>

        <line x1="250" y1="420"
              x2="250" y2="390"/>

        <line x1="80" y1="250"
              x2="110" y2="250"/>

      </g>

      <!-- PUNTO VIVO -->

      <circle
          r="5"
          class="live-dot">

        <animateMotion
            dur="14s"
            repeatCount="indefinite"
            rotate="auto">

          <mpath href="#orbitPath"/>

        </animateMotion>

      </circle>

      <path

          id="orbitPath"

          d="
          M250 80
          A170 170 0 1 1
          249.9 80"

          fill="none"/>

    </svg>

  </div>
</template>

<style scoped>

@import "@/assets/styles/login/tech-ring.css";

</style>
