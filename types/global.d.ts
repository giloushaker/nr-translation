import type { NotificationsOptions } from "@kyvg/vue3-notification";
import type { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
declare global {
  var notify: (arg: NotificationsOptions | string) => unknown;
  var system: GameSystemFiles | undefined;
  var strings: Record<string, Set<string>> | undefined;
  var translations: TranslationString[] | undefined;
}

