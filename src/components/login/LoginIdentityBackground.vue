<template>
  <div class="identity-background">

    <svg
      class="identity-svg"
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid slice"
    >

      <defs>

        <linearGradient id="curveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#60A5FA" stop-opacity="0"/>
          <stop offset="50%" stop-color="#60A5FA" stop-opacity=".22"/>
          <stop offset="100%" stop-color="#60A5FA" stop-opacity="0"/>
        </linearGradient>

        <linearGradient id="curveGradient2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#93C5FD" stop-opacity="0"/>
          <stop offset="45%" stop-color="#93C5FD" stop-opacity=".18"/>
          <stop offset="100%" stop-color="#93C5FD" stop-opacity="0"/>
        </linearGradient>

        <filter id="softGlow">
          <feGaussianBlur stdDeviation="6"/>
        </filter>

      </defs>

      <!-- Curvas principales -->

      <path
        class="curve c1"
        d="M-120 690
           C120 470
           320 620
           610 410
           S1040 280
           1350 520"
      />

      <path
        class="curve c2"
        d="M-80 250
           C250 150
           420 340
           720 240
           S1090 150
           1380 320"
      />

      <path
        class="curve c3"
        d="M150 870
           C420 660
           650 760
           960 520
           S1320 350
           1500 430"
      />

      <!-- conexiones -->

      <g class="links">

        <line x1="230" y1="220" x2="340" y2="310"/>
        <line x1="340" y1="310" x2="520" y2="260"/>
        <line x1="520" y1="260" x2="640" y2="350"/>

        <line x1="690" y1="180" x2="820" y2="240"/>
        <line x1="820" y1="240" x2="930" y2="170"/>

        <line x1="300" y1="560" x2="430" y2="500"/>
        <line x1="430" y1="500" x2="560" y2="560"/>
        <line x1="560" y1="560" x2="720" y2="470"/>

      </g>

      <!-- nodos -->

      <g class="nodes">

        <circle cx="230" cy="220" r="4"/>
        <circle cx="340" cy="310" r="5"/>
        <circle cx="520" cy="260" r="4"/>
        <circle cx="640" cy="350" r="5"/>

        <circle cx="690" cy="180" r="4"/>
        <circle cx="820" cy="240" r="5"/>
        <circle cx="930" cy="170" r="4"/>

        <circle cx="300" cy="560" r="4"/>
        <circle cx="430" cy="500" r="5"/>
        <circle cx="560" cy="560" r="4"/>
        <circle cx="720" cy="470" r="5"/>

      </g>

      <!-- glow -->

      <g filter="url(#softGlow)" opacity=".22">

        <circle cx="820" cy="240" r="8" fill="#60A5FA"/>
        <circle cx="430" cy="500" r="8" fill="#60A5FA"/>
        <circle cx="340" cy="310" r="8" fill="#60A5FA"/>

      </g>

    </svg>

    <div class="particle p1"></div>
    <div class="particle p2"></div>
    <div class="particle p3"></div>
    <div class="particle p4"></div>
    <div class="particle p5"></div>
    <div class="particle p6"></div>

  </div>
</template>

<script setup>
</script>

<style scoped>

@import "@/assets/styles/login/background.css";

</style>
