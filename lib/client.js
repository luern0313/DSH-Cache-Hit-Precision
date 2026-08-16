window.__ModuleLoader__.load({
    id: "dsh-cache-hit-precision",
    factory: (require) => {
        var module = { exports: {} };
        var exports = module.exports;
        Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
        let react = require("react");
        let react_jsx_runtime = require("react/jsx-runtime");

        /**
         * The original StatsLine is registered by `@deepseek-ai/dsh-client-ui-conversation`
         * as a list entry with id `stats` at the default priority 0.  We register
         * our own entry with the same id and a lower priority so it shadows the
         * original cell.  Our component then renders the original component with
         * one difference: the `stats.cacheHit` translation receives a two-decimal
         * percentage recomputed from the `tokenUsage` projection, instead of the
         * rounded integer the original passes.
         */
        const STATS_SLOT = "conversation.composer.dock";
        const STATS_ID = "stats";
        const STATS_KEY = "stats.cacheHit";
        const CONVERSATION_NS = "conversation";
        const ORIGINAL_PRIORITY = 0;

        /**
         * Sum the three disjoint prompt-side billing buckets.  Mirrors the
         * original `billedInputTokens` so the denominator matches exactly.
         */
        function billedInputTokens(usage) {
            const uncached = Number(usage?.uncachedInputTokens ?? 0);
            const read = Number(usage?.cacheReadTokens ?? 0);
            const write = Number(usage?.cacheWriteTokens ?? 0);
            if (![uncached, read, write].every(Number.isFinite)) return 0;
            return uncached + read + write;
        }

        /**
         * Exact cache-hit share of prompt-side input, as a number, or null when
         * the value cannot be computed.  The original rounds this to an integer
         * before localizing; we recompute it so the label can show two decimals.
         */
        function exactCacheHitPercent(usage) {
            if (usage === void 0 || usage === null) return null;
            const denominator = billedInputTokens(usage);
            if (!Number.isFinite(denominator) || denominator <= 0) return null;
            const numerator = Number(usage.cacheReadTokens ?? 0);
            if (!Number.isFinite(numerator)) return null;
            const percent = numerator / denominator * 100;
            return Number.isFinite(percent) ? percent : null;
        }

        /**
         * Shadowing StatsLine wrapper.
         *
         * It renders the original component with all of its usual slot props,
         * but replaces `t` with a binder that formats `stats.cacheHit` from the
         * exact projection value.  If a required seat is somehow missing, it
         * renders nothing rather than crashing.
         *
         * `Original` is a React component type, not necessarily a function:
         * the upstream StatsLine is wrapped in `React.memo`, which is an object
         * with a `$$typeof` marker in React 18.
         */
        const isComponentType = (value) => {
            return typeof value === "function" || (typeof value === "object" && value !== null && value.$$typeof !== void 0);
        };

        const CacheHitStats = react.memo(function CacheHitStats({ Original, useProjection, t, ...props }) {
            const usage = typeof useProjection === "function" ? useProjection("tokenUsage") : void 0;
            const patchedT = react.useMemo(() => (key, params) => {
                if (key !== STATS_KEY) return t(key, params);
                const percent = exactCacheHitPercent(usage);
                if (percent === null) return t(key, params);
                return t(key, { percent: percent.toFixed(2) });
            }, [t, usage]);

            if (!isComponentType(Original) || typeof t !== "function" || typeof useProjection !== "function") return null;
            return react_jsx_runtime.jsx(Original, { ...props, useProjection, t: patchedT });
        });

        /**
         * Client plugin body: wait for the original stats slot entry, then
         * shadow it.
         *
         * The subscription makes registration robust regardless of plugin load
         * order; `ctx.effect` ties the shadow registration to this plugin's
         * lifetime.  The shadow priority is chosen below every existing `stats`
         * entry so a co-existing shadow cannot collide at load time.
         */
        function apply(ctx) {
            const slots = ctx.slots;
            let shadowRegistration = null;

            const findOriginal = () => slots.entries(STATS_SLOT).find((entry) => {
                return entry.options.id === STATS_ID && (entry.options.priority ?? 0) === ORIGINAL_PRIORITY;
            });

            const nextShadowPriority = () => {
                const priorities = slots.entries(STATS_SLOT)
                    .filter((entry) => entry.options.id === STATS_ID)
                    .map((entry) => entry.options.priority ?? 0)
                    .filter((priority) => Number.isFinite(priority));
                return Math.min(ORIGINAL_PRIORITY, ...priorities) - 1;
            };

            const ensureShadow = () => {
                if (shadowRegistration) return;
                if (slots.spec(STATS_SLOT) === void 0) return;
                const original = findOriginal();
                if (original === void 0) return;

                shadowRegistration = slots.register({
                    name: STATS_SLOT,
                    id: STATS_ID,
                    priority: nextShadowPriority(),
                    order: 0,
                    locale: CONVERSATION_NS,
                    inject: () => ({ Original: original.component })
                }, CacheHitStats);
            };

            ctx.effect(() => {
                ensureShadow();
                const unsubscribe = slots.subscribe(STATS_SLOT, ensureShadow);
                return () => {
                    unsubscribe();
                    if (shadowRegistration) {
                        shadowRegistration();
                        shadowRegistration = null;
                    }
                };
            }, "dsh-cache-hit-precision: shadow stats");
        }

        exports.apply = apply;
        exports.inject = ["slots"];
        return module.exports;
    }
});
