// Vue wrapper for bo-grid (`bo-grid/vue`): every <Grid> prop as an attribute
// (`:rows`, `:row-height`, a bare `footer`), every callback as an event
// (`@cell-edit` is `onCellEdit`), and the grid's API on the template ref.
//
//   <script setup lang="ts">
//   import { BoGrid } from 'bo-grid/vue';
//   const grid = ref<InstanceType<typeof BoGrid>>();
//   // grid.value?.api?.patchRows([[id, { last }]]); a live feed, with no re-render
//   </script>
//   <BoGrid ref="grid" :rows="rows" :columns="columns" :height="520" @cell-edit="save" />
//
// It renders the <bo-grid> custom element, loaded on the client so server
// rendering is safe, inside a div that takes `class` and `style`, and sets
// the element's `config` from the attributes on each render. The grid sees
// a new `rows` array, not changes inside one: replace the array (from a
// shallowRef, say) or patch through the API.
import { camelize, defineComponent, h, onMounted, ref, shallowRef, toRaw, type DefineComponent } from 'vue';
import type { GridApi } from '../lib/grid/api';
import { BOOLEAN_PROPS } from './booleans';
import type { BoGridConfig } from './element';

const defined = (): boolean => typeof customElements !== 'undefined' && customElements.get('bo-grid') !== undefined;

type Handler = (...args: unknown[]) => unknown;

/** One listener, or several bound to the same event, as one function. */
function listener(v: unknown): Handler | undefined {
  if (typeof v === 'function') return v as Handler;
  if (Array.isArray(v)) return (...args) => v.forEach((f: Handler) => f(...args));
  return undefined;
}

/** An attribute's value as the grid's prop: a bare boolean attribute is
    true, several listeners one function, and a Vue proxy its plain object
    (the grid reads it many times; Vue would track nothing there). */
function propValue(key: string, v: unknown): unknown {
  if (v === '' && BOOLEAN_PROPS.has(key)) return true;
  if (/^on[A-Z]/.test(key)) return listener(v) ?? v;
  return toRaw(v);
}

const Impl = defineComponent({
  name: 'BoGrid',
  inheritAttrs: false,
  setup(_, { attrs, expose }) {
    // Not ready on the first render, even with the element already defined,
    // so it matches what a server rendered and hydrates cleanly.
    const ready = ref(false);
    const failed = shallowRef<unknown>(null);
    const api = shallowRef<GridApi | null>(null);
    expose({ api });

    onMounted(() => {
      if (defined()) return void (ready.value = true);
      import('./element').then(
        () => (ready.value = true),
        (e: unknown) => (failed.value = e ?? new Error('bo-grid: loading the element failed')),
      );
    });

    const onReady = (a: GridApi): void => {
      api.value = a;
      listener(attrs.onReady)?.(a);
    };

    return () => {
      if (failed.value) throw failed.value;
      const config: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(attrs)) {
        if (k === 'class' || k === 'style') continue;
        const key = camelize(k);
        config[key] = propValue(key, v);
      }
      config.onReady = onReady;
      const placeholder = !ready.value && typeof config.height === 'number' ? { height: `${config.height}px` } : undefined;
      return h(
        'div',
        { class: attrs.class, style: [placeholder, attrs.style] },
        ready.value ? [h('bo-grid', { style: 'display:block', '.config': config })] : [],
      );
    };
  },
});

/** The grid as a Vue component; the template ref's `api` is the grid's API
    once it is ready. */
export const BoGrid = Impl as unknown as DefineComponent<BoGridConfig, { api: GridApi | null }>;
