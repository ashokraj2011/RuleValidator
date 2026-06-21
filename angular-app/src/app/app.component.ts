import { ChangeDetectionStrategy, Component, HostListener } from '@angular/core';
import { ShellComponent } from './components/shell/shell.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ShellComponent],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  /**
   * App-like selection behaviour: a click on UI chrome (cards, heatmap cells,
   * labels, buttons) must never start a text selection that spills over to the
   * rest of the page. CSS `user-select: none` handles most of this, but this
   * guard is the authoritative backstop — it cancels selection unless the
   * interaction starts inside an editable field, code/snapshot block, or an
   * element explicitly opted in with `.select-text`.
   */
  @HostListener('document:selectstart', ['$event'])
  onSelectStart(event: Event) {
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, pre, code, [contenteditable="true"], .select-text')) {
      return;
    }
    event.preventDefault();
  }
}
