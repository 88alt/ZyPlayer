type EventHandler = (...args: any[]) => void;

interface EventItem {
  fn: EventHandler;
  ctx: any;
}

export default class Emitter {
  private e: Record<string, EventItem[]> = {};

  on(name: string, fn: EventHandler, ctx?: any): this {
    const e = this.e;
    (e[name] || (e[name] = [])).push({ fn, ctx });
    return this;
  }

  once(name: string, fn: EventHandler, ctx?: any): this {
    const off = this.off.bind(this);
    function listener(...args: any[]) {
      off(name, listener);
      fn.apply(ctx, args);
    }
    listener._ = fn;
    return this.on(name, listener, ctx);
  }

  emit(name: string, ...data: any[]): this {
    const evtArr = ((this.e || (this.e = {}))[name] || []).slice();
    for (let i = 0; i < evtArr.length; i += 1) {
      evtArr[i].fn.apply(evtArr[i].ctx, data);
    }
    return this;
  }

  off(name: string, callback?: EventHandler): this {
    const e = this.e;
    const evts = e[name];
    const liveEvents = [];
    if (evts && callback) {
      for (let i = 0, len = evts.length; i < len; i += 1) {
        if (evts[i].fn !== callback && (evts[i].fn as any)._ !== callback) {
          liveEvents.push(evts[i]);
        }
      }
    }
    if (liveEvents.length) {
      e[name] = liveEvents;
    } else {
      delete e[name];
    }
    return this;
  }
}
