import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { SearchBox } from '../../shared/search-box/search-box';
import { normalizeQuery } from '../../shared/search.util';
import { SEARCH_GROUPS, SearchItem, SiteSearchService } from '../../services/site-search.service';

interface ResultGroup {
  name: string;
  items: SearchItem[];
}

// หน้า "ค้นหา" - ค้นได้ทุกอย่างบนเว็บในที่เดียว: คอก อุปกรณ์ ไข่ ตรวจสุขภาพ วัคซีน (ที่ให้แล้ว
// และประเภทยา) นัดตรวจ การแจ้งเตือน ประวัติอาหาร และเมนูต่างๆ กดผลลัพธ์แล้วไปหน้านั้นเลย
@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, RouterModule, SearchBox],
  templateUrl: './Search.html',
  styleUrls: ['./Search.scss']
})
export class SearchPageComponent implements OnInit {
  query = '';
  isLoading = true;
  private index: SearchItem[] = [];

  // กลุ่มที่เปิดดูทั้งหมดอยู่ (ที่เหลือโชว์แค่ส่วนต้นให้หน้าไม่ยาวเกินไป)
  private expanded = new Set<string>();
  private readonly previewCount = 8;

  constructor(
    private route: ActivatedRoute,
    private search: SiteSearchService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.query = this.route.snapshot.queryParamMap.get('q') ?? '';
    this.search.buildIndex().subscribe({
      next: (index) => {
        this.index = index;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onQueryChange(value: string) {
    this.query = value;
    this.expanded.clear();
  }

  get hasQuery(): boolean {
    return normalizeQuery(this.query).length > 0;
  }

  get groups(): ResultGroup[] {
    const results = this.search.search(this.index, this.query);
    return SEARCH_GROUPS
      .map((name) => ({ name, items: results.filter((r) => r.group === name) }))
      .filter((g) => g.items.length > 0);
  }

  get totalResults(): number {
    return this.groups.reduce((sum, g) => sum + g.items.length, 0);
  }

  visibleItems(group: ResultGroup): SearchItem[] {
    return this.expanded.has(group.name) ? group.items : group.items.slice(0, this.previewCount);
  }

  isExpanded(group: ResultGroup): boolean {
    return this.expanded.has(group.name);
  }

  toggleGroup(group: ResultGroup) {
    if (this.expanded.has(group.name)) this.expanded.delete(group.name);
    else this.expanded.add(group.name);
  }

  hiddenCount(group: ResultGroup): number {
    return Math.max(0, group.items.length - this.previewCount);
  }

  open(item: SearchItem) {
    this.search.open(item);
  }
}
