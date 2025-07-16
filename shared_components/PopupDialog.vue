<template>
  <Teleport to="#popups" v-if="content" ref="popup">
    <div class="container" @click="stop" :class="{ allowoverflow: overflow }">
      <div class="veil" @click="veil_close_popup"></div>
      <div class="box" :class="{ print }" :style="slotstyle">
        <div class="content" ref="content">
          <div class="head" v-if="x">
            <slot name="header" />
            <div @click="close" v-if="x" class="xCross imgBt">
              <img style="display: block" src="/assets/icons/blackcross.png" />
            </div>
          </div>

          <slot />
        </div>
        <div class="close-wrap">
          <slot name="boutons"></slot>
          <template v-for="button in buttons">
            <button
              :disabled="button.disabled === undefined ? false : button.disabled"
              class="bouton close"
              @click="click_buttons(button)"
              >{{ button.label }}</button
            >
          </template>
          <button :disabled="disabled" v-if="button" class="bouton close" @click="click_button">
            {{ button }}
          </button>
          <button v-if="!noclose" class="bouton close" @click="button_close_popup">
            {{ text }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script lang="ts">
import { getRandomKey } from "~/assets/shared/util";
export interface PopupButton {
  label: string;
  event?: string;
  function?: Function;
  close: boolean;
  disabled?: boolean;
}
export default {
  name: "PopupDialog",
  emits: ["button", "close", "update:modelValue", "cancel"],

  methods: {
    stop(event: any) {
      event.stopImmediatePropagation();
    },

    click_button() {
      const obj = { close: true as boolean | Promise<boolean> };
      this.$emit("button", obj);
      if (obj.close instanceof Promise) {
        obj.close.then((close) => {
          if (close) this.close();
        });
      } else {
        if (this.buttonclose && obj.close) {
          this.close();
        }
      }
    },

    click_buttons(button: PopupButton) {
      if (button.event) {
        this.$emit(button.event as any, button);
      }
      if (button.function) {
        button.function();
      }
      if (button.close) {
        this.close();
      }
    },

    veil_close_popup() {
      if (this.nocloseonclickoutside) {
        return;
      }
      this.close();
    },

    button_close_popup() {
      this.close();
    },

    close() {
      if (this.mobile) {
        history.back();
      } else {
        this.doClose();
      }
    },

    doClose() {
      this.content = false;
      this.$emit("update:modelValue", this.content);
      this.$emit("cancel");
      this.$emit("close");
    },

    popstate(e: PopStateEvent) {
      if (this.mobile && e.state.popupDepth && e.state.popupDepth >= this.popupDepth) return;
      this.doClose();
    },

    esc_close_popup(e: KeyboardEvent) {
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (e.key?.toLowerCase() === "escape") {
        this.close();
      }
    },

    before_print(e: Event) {
      const node = this.$refs.content as HTMLElement;
      let cloned = node.cloneNode(true) as HTMLElement;
      document.body.appendChild(cloned);
      cloned.classList.add("printable");
      const after_print = () => {
        document.body.removeChild(cloned);
      };
      addEventListener("afterprint", after_print, { once: true });
    },
    isMobile() {
      // @ts-ignore
      var match = window.matchMedia || window.msMatchMedia;
      if (match) {
        var mq = match("(pointer:coarse)");
        return mq.matches;
      }
      return false;
    },
  },

  mounted() {
    addEventListener("keydown", this.esc_close_popup);
    if (this.print) {
      addEventListener("beforeprint", this.before_print);
    }
    if (this.mobile) {
      history.pushState(
        {
          url: window.location.href,
          popupId: this.popupUid,
          popupDepth: this.popupDepth,
        },
        ""
      );
    }
    addEventListener("popstate", this.popstate);

    addEventListener("beforepush", this.doClose);
  },

  unmounted() {
    removeEventListener("keydown", this.esc_close_popup);
    if (this.print) {
      removeEventListener("beforeprint", this.before_print);
    }
    removeEventListener("popstate", this.popstate);
    removeEventListener("beforepush", this.doClose);
  },

  props: {
    modelValue: {
      default: true,
      type: Boolean,
    },
    text: {
      type: String,
      default: "Close",
    },
    noclose: {
      default: false,
      type: Boolean,
    },
    x: {
      default: false,
      type: Boolean,
    },
    button: {
      default: "",
      type: String,
    },
    disabled: {
      default: false,
      type: Boolean,
    },
    slotstyle: {
      default: "",
    },
    print: {
      type: Boolean,
      default: false,
    },
    buttonclose: {
      type: Boolean,
      default: true,
    },
    buttons: {
      type: Array<PopupButton>,
      default: [],
    },
    overflow: {
      type: Boolean,
      default: false,
    },
    keeponroutechange: {
      type: Boolean,
      default: false,
    },
    width: {
      type: String,
      default: "300px",
    },
    nocloseonclickoutside: {
      type: Boolean,
      default: false,
    },
  },
  watch: {
    modelValue(n) {
      this.content = n;
    },
  },
  data() {
    const key = getRandomKey();
    return {
      content: this.modelValue,
      mobile: this.isMobile(),
      popupUid: key,
      popupDepth: (document.getElementById("popups")?.childElementCount || 0) + 1,
    };
  },
};
</script>

<style scoped lang="scss">
@import "@/shared_components/css/vars.scss";

.container {
  z-index: 1000;
  position: fixed;
  top: var(--safe-area-inset-top, 0);
  left: var(--safe-area-inset-left, 0);
  right: var(--safe-area-inset-right, 0);
  bottom: var(--safe-area-inset-bottom, 0);
  display: flex;
  justify-content: center;
  align-items: center;
}

.box {
  background-color: $popups_background;
  background-image: $popups_background;
  max-height: calc(80% - (var(--safe-area-inset-top, 0) + (var(--safe-area-inset-bottom, 0))));

  display: inline-block;
  position: fixed;
  width: max-content;
  max-width: calc(min(95%, 1200) - (var(--safe-area-inset-left, 0) + var(--safe-area-inset-right, 0)));
  min-width: calc(
    min(min(95%, 1200), v-bind(width)) - (var(--safe-area-inset-left, 0) + var(--safe-area-inset-right, 0))
  );

  z-index: 1001;

  overflow-y: auto;
  scrollbar-width: thin;
}

html.dark .box {
  scrollbar-color: rgba(255, 255, 255, 0.3) rgba(0, 0, 0, 0);
}
.close-wrap {
  margin-top: 10px !important;
}

.veil {
  position: fixed;
  top: var(--safe-area-inset-top, 0);
  left: var(--safe-area-inset-left, 0);
  right: var(--safe-area-inset-right, 0);
  bottom: var(--safe-area-inset-bottom, 0);
  background-color: black;
  opacity: 0.7;
}

.box {
  padding: 5px;
}

.box.print {
  padding: unset !important;
  margin: unset !important;
  border: unset !important;
}

.close {
  display: inline-block;
  text-align: center;
}

.close-wrap {
  margin: auto;
  width: calc((100%) - 10px);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  position: sticky;
  bottom: 0px;
}

.x {
  position: absolute;
  top: 4px;
  right: 4px;
  cursor: pointer;
}

@media print {
  .close-wrap {
    display: none;
  }

  .content {
    zoom: 70%;
    max-width: 1000px;
  }
}

.xCross {
  position: absolute;
  top: 6px;
  right: 4px;
  cursor: pointer;
}

.head {
  position: sticky;
  top: 0;
  background-color: rgba(0, 0, 0, 0.1);
  border: 1px solid $box_border;
  padding: 5px;
  margin-bottom: 5px;
  font-size: $fontHeaderSize;
  font-weight: bold;
  border-radius: $header_radius;
}

.print {
  width: calc(100% - (var(--safe-area-inset-right, 0) + var(--safe-area-inset-left, 0))) !important;
  height: calc(100% - (var(--safe-area-inset-top, 0) + var(--safe-area-inset-bottom, 0))) !important;
  max-width: unset !important;
  max-height: unset !important;
  display: flex;
  flex-direction: column;

  .close-wrap {
    position: sticky;
    margin-left: auto;
    margin-right: auto;
    bottom: 20px;
  }

  @media print {
    overflow: visible;
  }

  .content {
    margin-left: auto;
    margin-right: auto;
    // max-width: 1000px;
  }
}
</style>
