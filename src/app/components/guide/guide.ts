import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StatusBadgeComponent } from '../status-badge/status-badge';

@Component({
  selector: 'app-guide',
  standalone: true,
  imports: [RouterLink, StatusBadgeComponent],
  templateUrl: './guide.html',
})
export class GuideComponent {}
