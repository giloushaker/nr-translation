<template>
  <div id="popups" />
  <div id="dialogs" />
  <div id="app">
    <Notifications :style="{ 'margin-top': `${titleSize + 5}px` }" position="top center" />
    <ClientOnly>
      <div class="title" ref="title" @resize="update">
        <TitleBar />
      </div>
      <div class="content" :style="{ height: `calc(100vh - ${titleSize}px)` }">
        <NuxtPage :keepalive="true" />
      </div>
    </ClientOnly>
  </div>
</template>

<script lang="ts">
export default defineComponent({
  data() {
    return {
      val: "",
      titleSize: 50,
    };
  },
  methods: {
    update() {
      this.titleSize = (this.$refs.title as HTMLDivElement).clientHeight;
    },
  },
  mounted() {
    addEventListener("resize", this.update);
  },
  unmounted() {
    removeEventListener("resize", this.update);
  },
});
</script>

<style lang="scss">
@use "@/shared_components/css/vars.scss" as *;

#app {
  padding: 0 !important;
  height: 100%;
  width: 100%;
  position: fixed;
}

html {
  font-family: sans-serif;
  background-image: linear-gradient(
    rgba(var(--bg-r), var(--bg-g), var(--bg-b), var(--bg-a)),
    rgba(var(--bg-r), var(--bg-g), var(--bg-b), var(--bg-a))
  );
  background-size: var(--backgroundSize);
  background-color: rgb(var(--bg-r), var(--bg-g), var(--bg-b));
  filter: var(--global-filter);
  color: var(--font-color);
}

img.icon,
svg.icon,
img.imgBt {
  filter: var(--image-filter);
}

input:hover,
button:hover {
  border-color: $input_highlights !important;
  filter: brightness(110%);
}

select:hover {
  border-color: $input_highlights;
}

select,
input,
button,
textarea {
  border-radius: var(--input-radius);
  background-color: var(--input-background);
  color: var(--font-color);
}

body {
  font-family: $font;
  font-size: $fontSize;
}

a {
  color: $blue;
}

.warning {
  color: $orange;
  font-weight: bold;
}

.error {
  color: $red;
  font-weight: bold;
}

select,
input,
a {
  font-family: $fontButton !important;
  font-size: $fontButtonSize !important;
}

.red {
  color: $red;
}

.green {
  color: $green;
}

.blue {
  color: $blue;
}

.grey,
.gray {
  color: $gray;
}

html {
  /* Handle */
  ::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.3);
    border-radius: 5px;
  }

  /* Handle on hover */
  ::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.4);
  }

  /* Handle on mouse */
  ::-webkit-scrollbar-thumb:active {
    background: rgba(0, 0, 0, 0.5);
  }

  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
}

html.dark {
  /* Handle */
  ::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 5px;
  }

  /* Handle on hover */
  ::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  /* Handle on mouse */
  ::-webkit-scrollbar-thumb:active {
    background: rgba(255, 255, 255, 0.4);
  }

  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
}

fieldset {
  border: 1px solid $box_border;
}
</style>
