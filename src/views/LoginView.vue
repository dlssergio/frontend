<template>
  <div class="login-page">

    <div class="login-wrapper">

      <LoginBrandPanel />

      <LoginForm
        :loading="isLoading"
        :error="formError"
        @submit="handleLogin"
      />

    </div>

  </div>
</template>

<script setup>

import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

import LoginBrandPanel from '@/components/login/LoginBrandPanel.vue'
import LoginForm from '@/components/login/LoginForm.vue'

const router = useRouter()

const authStore = useAuthStore()

const isLoading = ref(false)

const formError = ref('')

const handleLogin = async (credentials) => {

    formError.value=''

    isLoading.value=true

    try{

        await authStore.login(

            credentials.username,

            credentials.password

        )

        router.push({

            name:'home'

        })

    }
    catch(error){

        formError.value=

            error?.message ||

            'Usuario o contraseña incorrectos.'

    }
    finally{

        isLoading.value=false

    }

}

</script>

<style scoped>

.login-page{

    width:100vw;

    height:100vh;

    overflow:hidden;

    display:flex;

    justify-content:center;

    align-items:center;

    background:

        radial-gradient(

            circle at top,

            #204b93 0%,

            #14376d 35%,

            #0d2347 70%,

            #08162d 100%

        );

    position:relative;

}

/* Fondo ambiental */

.login-page::before{

    content:"";

    position:absolute;

    inset:0;

    background:

        radial-gradient(

            circle at 20% 20%,

            rgba(96,165,250,.10),

            transparent 45%

        ),

        radial-gradient(

            circle at 85% 80%,

            rgba(59,130,246,.08),

            transparent 40%

        );

    filter:blur(50px);

}

/* Tarjeta */

.login-wrapper{

    position:relative;

    z-index:2;

    width:1250px;

    height:720px;

    display:flex;

    overflow:hidden;

    border-radius:28px;

    background:white;

    box-shadow:

        0 40px 90px rgba(0,0,0,.35),

        0 0 0 1px rgba(255,255,255,.05);

    animation:appear .7s ease;

}

/* Responsive */

@media(max-width:1280px){

.login-wrapper{

width:95vw;

height:92vh;

}

}

@media(max-width:980px){

.login-wrapper{

width:100%;

height:100%;

border-radius:0;

}

}

@keyframes appear{

from{

opacity:0;

transform:

translateY(25px)

scale(.98);

}

to{

opacity:1;

transform:none;

}

}

</style>
