// UI state the chrome shares: the mobile sidebar drawer and the quick-jump
// palette.
class Shell {
  drawer = $state(false);
  jump = $state(false);
}

export const shell = new Shell();
