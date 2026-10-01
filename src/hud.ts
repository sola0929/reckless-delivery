export class Hud {
  private readonly speedEl = document.getElementById('speed')!;
  private readonly cargoEl = document.getElementById('cargo')!;
  private speedText = '';
  private cargoText = '';

  update(speedMps: number, cargoOnTruck: number, cargoTotal: number): void {
    const speed = String(Math.round(Math.abs(speedMps) * 3.6));
    if (speed !== this.speedText) this.speedEl.textContent = this.speedText = speed;

    const cargo = `${cargoOnTruck} / ${cargoTotal}`;
    if (cargo !== this.cargoText) {
      this.cargoEl.textContent = this.cargoText = cargo;
      this.cargoEl.classList.toggle('lost', cargoOnTruck < cargoTotal);
    }
  }
}
