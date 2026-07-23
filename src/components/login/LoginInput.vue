<template>
  <div class="field">

    <div
      class="input-wrapper"
      :class="{
        focused: isFocused,
        filled: !!modelValue,
        error: !!error
      }"
    >

      <div class="icon">

        <slot name="icon"/>

      </div>

      <input

        :id="id"

        :type="currentType"

        :value="modelValue"

        @focus="isFocused=true"

        @blur="isFocused=false"

        @input="$emit('update:modelValue',$event.target.value)"

        @keyup.enter="$emit('enter')"

      />

      <label :for="id">

        {{ label }}

      </label>

      <button

        v-if="type==='password'"

        class="toggle"

        type="button"

        @click="showPassword=!showPassword"

      >

        {{ showPassword ? 'Ocultar' : 'Mostrar' }}

      </button>

    </div>

    <div
      v-if="error"
      class="error">

      {{ error }}

    </div>

  </div>
</template>

<script setup>

import {ref,computed} from 'vue'

const props=defineProps({

id:String,

label:String,

modelValue:String,

type:{

type:String,

default:'text'

},

error:String

})

defineEmits([

'update:modelValue',

'enter'

])

const isFocused=ref(false)

const showPassword=ref(false)

const currentType=computed(()=>{

if(props.type!=='password')

return props.type

return showPassword.value ? 'text':'password'

})

</script>

<style scoped>

.field{

display:flex;

flex-direction:column;

gap:8px;

}

.input-wrapper{

position:relative;

height:58px;

border:2px solid #E2E8F0;

border-radius:14px;

display:flex;

align-items:center;

padding:0 18px;

transition:.25s;

background:white;

}

.input-wrapper:hover{

border-color:#CBD5E1;

}

.input-wrapper.focused{

border-color:#2563EB;

box-shadow:

0 0 0 4px rgba(37,99,235,.08);

}

.input-wrapper.error{

border-color:#DC2626;

}

.icon{

width:22px;

display:flex;

justify-content:center;

align-items:center;

margin-right:14px;

color:#64748B;

}

.icon svg{

width:18px;

height:18px;

fill:currentColor;

}

input{

flex:1;

border:none;

outline:none;

font-size:15px;

background:transparent;

color:#0F172A;

}

label{

position:absolute;

left:56px;

top:18px;

background:white;

padding:0 6px;

color:#64748B;

pointer-events:none;

transition:.20s;

}

.input-wrapper.focused label,

.input-wrapper.filled label{

top:-10px;

font-size:12px;

color:#2563EB;

font-weight:600;

}

.toggle{

border:none;

background:none;

color:#2563EB;

font-weight:600;

cursor:pointer;

font-size:13px;

padding:0;

}

.error{

font-size:13px;

font-weight:600;

color:#DC2626;

padding-left:6px;

}

</style>
