<template>
  <section class="form-panel">

    <div class="content">

      <!-- Logo -->

      <h1 class="title">
        Bienvenido
      </h1>

      <p class="subtitle">
        Inicie sesión para acceder a la plataforma.
      </p>

      <form
        class="form"
        @submit.prevent="submit"
      >

        <!-- Usuario -->

        <LoginInput
          id="username"
          label="Usuario"
          v-model="username"
          :error="usernameError"
          @enter="submit"
        >

          <template #icon>

            <svg viewBox="0 0 24 24">

              <path
                d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4.4 0-8 2.1-8 4.8V21h16v-2.2C20 16.1 16.4 14 12 14z"
              />

            </svg>

          </template>

        </LoginInput>

        <!-- Password -->

        <LoginInput
          id="password"
          label="Contraseña"
          type="password"
          v-model="password"
          :error="passwordError"
          @enter="submit"
        >

          <template #icon>

            <svg viewBox="0 0 24 24">

              <path
                d="M17 9h-1V7a4 4 0 00-8 0v2H7a2 2 0 00-2 2v8a2 2 0 002 2h10a2 2 0 002-2v-8a2 2 0 00-2-2zm-7-2a2 2 0 114 0v2h-4z"
              />

            </svg>

          </template>

        </LoginInput>

        <div class="options">

          <label class="remember">

            <input
              type="checkbox"
              v-model="remember"
            >

            Recordarme

          </label>

          <a
            href="#"
            class="forgot"
          >

            ¿Olvidó su contraseña?

          </a>

        </div>

        <div
          v-if="error"
          class="form-error"
        >

          {{ error }}

        </div>

        <LoginButton
          :loading="loading"
          @click="submit"
        >

          Ingresar

        </LoginButton>

      </form>

      <div class="footer">

        <span class="version">

          v1.0.0

        </span>

        <span class="company">

          © G.U.R.I.

        </span>

      </div>

    </div>

  </section>
</template>

<script setup>

import { ref } from 'vue'

import logo from '@/assets/logo_guri.png'

import LoginInput from './LoginInput.vue'
import LoginButton from './LoginButton.vue'

const props = defineProps({

    loading:Boolean,

    error:String

})

const emit = defineEmits([

    'submit'

])

const username = ref('')
const password = ref('')
const remember = ref(false)

const usernameError = ref('')
const passwordError = ref('')

function validate(){

    usernameError.value=''

    passwordError.value=''

    let ok=true

    if(!username.value.trim()){

        usernameError.value='Ingrese el usuario'

        ok=false

    }

    if(!password.value){

        passwordError.value='Ingrese la contraseña'

        ok=false

    }

    return ok

}

function submit(){

    if(props.loading)
        return

    if(!validate())
        return

    emit('submit',{

        username:username.value.trim(),

        password:password.value,

        remember:remember.value

    })

}

</script>

<style scoped>

@import "@/assets/styles/login/form.css";

</style>
