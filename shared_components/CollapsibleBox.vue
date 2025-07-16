<template>
  <div
    :class="{
      box: !nobox && !noboxindent,
      nobox: nobox,
      nocollapse: !collapsible,
      noboxindent: noboxindent,
      verticalbox: collapsed && vertical,
    }"
    class="collapsibleBox"
    :id="id"
  >
    <h3
      v-if="!notitle"
      :class="[
        {
          arrowTitle: collapsible,
          normalTitle: !collapsible,
          collapsed: collapsible && collapsed,
          titleClickCollapsible: collapsible && !collapsed && titleCollapse,
          titleClickEffect: collapsed || collapsible,
        },
        title,
      ]"
      @click="titleSwitch"
    >
      <img v-if="collapsible" :src="dropdownSrc" class="icon arrow" @click.stop="collapseSwitch" />
      <slot name="title" class="title" />
    </h3>
    <div v-if="initiated" v-show="!collapsed || !collapsible" class="boxContent">
      <slot name="content" />
    </div>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    collapsible: {
      type: Boolean,
      default: true,
    },

    nobox: {
      type: Boolean,
      default: false,
    },

    noboxindent: {
      type: Boolean,
      default: false,
    },

    defcollapsed: {
      type: Boolean,
      default: true,
    },

    notitle: {
      type: Boolean,
      default: false,
    },

    title: {
      type: String,
      required: false,
      default: "titreCategory",
    },

    vertical: {
      type: Boolean,
      default: false,
    },

    titleCollapse: {
      type: Boolean,
      default: true,
    },
    id: {
      type: String,
      required: false,
    },
  },
  mounted() {
    if (this.id && this.$route.hash) {
      if (this.$route.hash.substring(1) === this.id && this.collapsed) {
        this.$nextTick(() => {
          this.collapseSwitch();
          (this.$el as HTMLDivElement)?.scrollIntoView({ block: "center" });
        });
      }
    }
  },
  data() {
    return {
      collapsed: true,
      initiated: false,
    };
  },

  created() {
    if (!this.collapsible || this.defcollapsed == false) {
      this.collapseSwitch();
    }
  },

  computed: {
    dropdownSrc() {
      let n = 2;
      if (this.$optionStore?.options?.appearence?.dropdownStyle) {
        n = this.$optionStore.options.appearence.dropdownStyle;
      }
      let images = [`/assets/icons/right${n}.png`, `/assets/icons/down${n}.png`];
      let index = this.collapsed ? 0 : 1;
      if (this.vertical) {
        index = 1 - index;
      }
      return images[index];
    },
  },

  methods: {
    collapseSwitch() {
      this.collapsed = !this.collapsed;
      this.initiated = true;
      if (this.collapsed == false) {
        this.$emit("open");
        this.$emit("change");
      } else {
        this.$emit("close");
        this.$emit("change");
      }
    },

    titleSwitch() {
      if (this.titleCollapse) {
        this.collapseSwitch();
      } else {
        this.$emit("titleClick");
      }
    },
  },

  watch: {
    collapsible() {
      this.initiated = true;
    },
  },
};
</script>
<style scoped lang="scss">
@import "@/shared_components/css/vars.scss";

.arrowTitle :deep(label) {
  cursor: pointer !important;
}

.arrowTitle.titleClickEffect {
  cursor: pointer !important;
}

.arrowTitle {
  position: relative;
  padding: 5px;

  img.arrow {
    vertical-align: bottom;
    margin-right: 5px;
  }
}

.normalTitle {
  position: relative;
  padding-top: 5px;
  padding-left: 5px;
  font-size: $fontHeaderSize !important;
  font-weight: bold;
}

.collapsibleBox.box {
  padding: 0px !important;
}

.boxContent {
  padding: 5px;
}

.nobox > .boxContent {
  padding: 0px;
}

.collapsed {
  filter: brightness(95%);
}

.titleClickCollapsible:hover {
  filter: brightness(95%) !important;
}

.arrowTitle.collapsed:hover {
  filter: brightness(105%) !important;
}

.verticalbox {
  width: 25px;

  h3 {
    text-orientation: mixed;
    writing-mode: vertical-rl;
    padding-left: 0px !important;
    padding-right: 0px !important;
  }

  img {
    margin-bottom: 5px;
  }
}
</style>
