const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

export class Hud {
  private readonly speedEl = document.getElementById('speed')!;
  private readonly cargoEl = document.getElementById('cargo')!;
  private readonly valueEl = document.getElementById('value')!;
  private readonly valueFullEl = document.getElementById('value-full')!;
  private readonly valueFill = document.getElementById('value-fill')!;
  private readonly popups = document.getElementById('popups')!;
  private speedText = '';
  private cargoText = '';
  private valueText = '';

  update(speedMps: number, cargoOnTruck: number, cargoTotal: number, value: number, fullValue: number): void {
    const speed = String(Math.round(Math.abs(speedMps) * 3.6));
    if (speed !== this.speedText) this.speedEl.textContent = this.speedText = speed;

    const cargo = `${cargoOnTruck} / ${cargoTotal}`;
    if (cargo !== this.cargoText) {
      this.cargoEl.textContent = this.cargoText = cargo;
      this.cargoEl.classList.toggle('lost', cargoOnTruck < cargoTotal);
    }

    const text = money(value);
    if (text !== this.valueText) {
      this.valueEl.textContent = this.valueText = text;
      this.valueFullEl.textContent = `/ ${money(fullValue)}`;
      const kept = fullValue > 0 ? value / fullValue : 0;
      this.valueFill.style.width = `${kept * 100}%`;
      this.valueFill.style.backgroundColor = kept > 0.75 ? '#6fd08c' : kept > 0.45 ? '#ffd166' : '#ff6b5a';
    }
  }

  /** Floating text at a screen position, e.g. money lost. */
  popup(text: string, x: number, y: number, big = false): void {
    const el = document.createElement('div');
    el.className = big ? 'popup big' : 'popup';
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.addEventListener('animationend', () => el.remove());
    this.popups.appendChild(el);
  }

  clearPopups(): void {
    this.popups.replaceChildren();
  }
}

export { money };
