<template>
  <section class="brand-panel">

    <LoginIdentityBackground />

    <div class="brand-content">

      <div class="logo-wrapper">

        <LoginTechRing />

        <img
          :src="logo"
          class="logo"
          alt="G.U.R.I."
        />

      </div>

      <div class="brand-text">

        <p class="claim">

          Unificando procesos.<br>
          Potenciando decisiones.

        </p>

        <div class="divider"></div>

        <div class="features">

          <span>

            <svg viewBox="0 0 24 24">
              <path d="M12 3l8 4v10l-8 4-8-4V7z"/>
            </svg>

            Integrado

          </span>

          <span>

            <svg viewBox="0 0 24 24">
              <path d="M12 2l7 3v6c0 5-3.4 8.9-7 11-3.6-2.1-7-6-7-11V5z"/>
            </svg>

            Seguro

          </span>

          <span>

            <svg viewBox="0 0 24 24">
              <path d="M4 18h16v2H4zm2-3l3-4 3 2 6-7 2 2-7 8-3-2-2 3z"/>
            </svg>

            Escalable

          </span>

        </div>

      </div>

    </div>

  </section>
</template>

<script setup>

import logo from '@/assets/logo_guri.png'

import LoginIdentityBackground from './LoginIdentityBackground.vue'
import LoginTechRing from './LoginTechRing.vue'

</script>

<style scoped>

@import "@/assets/styles/login/brand-panel.css";

</style>
