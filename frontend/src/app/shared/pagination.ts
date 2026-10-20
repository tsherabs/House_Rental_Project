import { Component, input, output } from '@angular/core';
import { Page } from '../core/api';
@Component({
  selector: 'app-pagination',
  template: ` @if (pagination().totalPages > 1) {
    <nav class="pagination" aria-label="Results pages">
      <button
        type="button"
        [disabled]="busy() || pagination().page <= 1"
        (click)="pageChange.emit(pagination().page - 1)"
      >
        Previous
      </button>
      <span>Page {{ pagination().page }} of {{ pagination().totalPages }}</span>
      <button
        type="button"
        [disabled]="busy() || pagination().page >= pagination().totalPages"
        (click)="pageChange.emit(pagination().page + 1)"
      >
        Next
      </button>
    </nav>
  }`,
})
export class Pagination {
  readonly pagination = input.required<Page<unknown>['pagination']>();
  readonly busy = input(false);
  readonly pageChange = output<number>();
}
