import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { interval, map, merge, Observable } from 'rxjs';
import { StreamService } from './stream.service.js';

@Controller('stream')
export class StreamController {
  constructor(private readonly stream: StreamService) {}

  @Sse()
  /**
   * SSE endpoint producing a merged stream of periodic heartbeats and
   * application events (ticks and hourly aggregates).
   */
  streamEndpoint(): Observable<MessageEvent> {
    const heartbeat$ = interval(15000).pipe(map(() => ({ data: { type: 'status', ok: true } })));
    const events$ = this.stream.observable.pipe(map((data: any) => ({ data })));
    return merge(heartbeat$, events$);
  }
}
