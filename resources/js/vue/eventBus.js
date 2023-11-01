import { ref } from 'vue'

const bus = ref(new Map())

export default function useEventsBus() {
  function emit(event, ...args) {
    bus.value.set(event, args)
  }

  return {
    emit,
    bus,
  }
}
