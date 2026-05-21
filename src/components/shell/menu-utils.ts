export function closeOtherShellMenus(currentMenu: HTMLDetailsElement) {
  document.querySelectorAll<HTMLDetailsElement>("details[data-shell-menu]").forEach((menu) => {
    if (menu !== currentMenu) {
      menu.open = false;
    }
  });
}
