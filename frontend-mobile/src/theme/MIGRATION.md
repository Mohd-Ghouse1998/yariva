# Theme migration TODO

The runtime theme is immutable. New code must read semantic colours from
`useTheme()` and component-scoped styles should use `createThemeStyleHook()`.
Do not restore module-level palette mutation or add a `key` that remounts the
navigation tree when the mode changes.

`palette`, `heartline`, `petal`, and `createThemedStyles` remain as deprecated,
light-theme-only compatibility exports while feature screens are migrated.
They can be removed after both searches return no feature results:

```sh
rg -l 'createThemedStyles' src/features app
rg -l 'theme/colors' src/features app
```

Migration pattern:

1. Replace render-time colour reads with `const { palette } = useTheme()`.
2. Replace `createThemedStyles(() => ({ ... }))` with a module-scoped
   `createThemeStyleHook((palette) => ({ ... }))`, then call that hook in the
   component.
3. Use semantic palette names rather than raw pink, teal, or neutral values.
4. Verify the screen in both modes without remounting or losing navigation,
   form, scroll, or draft state.
