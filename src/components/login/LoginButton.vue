<template>
  <button
    class="login-button"
    :disabled="loading || disabled"
    @click="$emit('click')"
    type="button"
  >
    <span
      v-if="!loading"
      class="content"
    >
      <slot />
    </span>

    <span
      v-else
      class="spinner"
    ></span>

    <span class="shine"></span>

  </button>
</template>

<script setup>

defineProps({

    loading:Boolean,

    disabled:Boolean

})

defineEmits([

    'click'

])

</script>

<style scoped>

.login-button{

    position:relative;

    overflow:hidden;

    width:100%;

    height:56px;

    border:none;

    border-radius:14px;

    cursor:pointer;

    color:white;

    font-size:15px;

    font-weight:700;

    letter-spacing:.4px;

    background:

        linear-gradient(
            135deg,
            #2563EB,
            #1D4ED8
        );

    box-shadow:

        0 12px 30px rgba(37,99,235,.28);

    transition:
        .25s;

}

.login-button:hover{

    transform:translateY(-2px);

    box-shadow:

        0 18px 36px rgba(37,99,235,.34);

}

.login-button:active{

    transform:translateY(1px);

}

.login-button:disabled{

    opacity:.70;

    cursor:not-allowed;

}

.content{

    position:relative;

    z-index:2;

}

/*--------------------------*/

.spinner{

    width:20px;

    height:20px;

    border-radius:50%;

    border:

        2px solid rgba(255,255,255,.30);

    border-top-color:white;

    display:inline-block;

    animation:spin .8s linear infinite;

    position:relative;

    z-index:2;

}

/*--------------------------*/

.shine{

    position:absolute;

    top:0;

    left:-120%;

    width:60%;

    height:100%;

    background:

        linear-gradient(

            90deg,

            transparent,

            rgba(255,255,255,.28),

            transparent

        );

    transform:skewX(-20deg);

}

.login-button:hover .shine{

    animation:shine .9s;

}

/*--------------------------*/

@keyframes spin{

    to{

        transform:rotate(360deg);

    }

}

@keyframes shine{

    from{

        left:-120%;

    }

    to{

        left:160%;

    }

}

</style>
