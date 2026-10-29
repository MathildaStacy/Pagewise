import NativeUiEnvironment, {
  type UiEnvironmentState,
} from './specs/NativeUiEnvironment';

export type UiEnvironment = UiEnvironmentState;

const unavailable: UiEnvironment = {
  lowRam: false,
  powerSave: false,
  blurAllowed: false,
};
let observerCount = 0;

function snapshot(value: UiEnvironmentState): UiEnvironment {
  return {
    lowRam: value.lowRam,
    powerSave: value.powerSave,
    blurAllowed: value.blurAllowed && !value.lowRam && !value.powerSave,
  };
}

/** 原生模块缺失或系统读取失败时关闭模糊，保留半透明材质填充。 */
export async function readUiEnvironment(): Promise<UiEnvironment> {
  if (!NativeUiEnvironment) {
    return { ...unavailable };
  }
  try {
    return snapshot(await NativeUiEnvironment.getCurrent());
  } catch {
    return { ...unavailable };
  }
}

/** 首位订阅者启动系统接收器，末位退订者释放；返回函数可重复调用。 */
export function subscribeUiEnvironment(
  listener: (environment: UiEnvironment) => void,
): () => void {
  if (!NativeUiEnvironment) {
    listener({ ...unavailable });
    return () => undefined;
  }
  const native = NativeUiEnvironment;
  const subscription = native.onChange(value => listener(snapshot(value)));
  try {
    if (observerCount === 0) {
      native.startObserving();
    }
    observerCount += 1;
  } catch {
    subscription.remove();
    listener({ ...unavailable });
    return () => undefined;
  }
  let removed = false;
  return () => {
    if (removed) {
      return;
    }
    removed = true;
    subscription.remove();
    observerCount -= 1;
    if (observerCount === 0) {
      native.stopObserving();
    }
  };
}
