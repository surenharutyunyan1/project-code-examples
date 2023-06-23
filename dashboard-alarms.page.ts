import { ChangeDetectionStrategy, Component, OnInit, ViewContainerRef } from "@angular/core";
import { With$Id, XaferDevice, XaferNotification, XaferNotificationState, XaferNotificationTopic } from "@src/../../types";
import { XaferDrawerService, XfrNotificationsService } from "@src/app/services";
import { combineLatest, Observable, Subject } from "rxjs";
import { debounceTime, map, scan, shareReplay, startWith, tap } from "rxjs/operators";

export const allTopics = Symbol('All Notification Topics');

type Values<T> = T extends Record<infer K, infer V> ? V : never;

function enumValues<T extends {}>(obj: T): Values<T>[] {
    return Object.values(obj) as Values<T>[];
}

const allTopicsValues = enumValues(XaferNotificationTopic);

@Component({
    templateUrl: './dashboard-alarms.page.html',
    styleUrls: ['./dashboard-alarms.page.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class XfrDashboardAlarmsPage {

    public readonly alarms$: Observable<With$Id<XaferNotification>[]>;
    public readonly alarmsCount$: Observable<number>;
    public readonly searchSubj = new Subject<string>();
    public readonly topicsSubj = new Subject<XaferNotificationTopic | typeof allTopics>();
    public readonly topics$: Observable<Set<XaferNotificationTopic>>;
    
    constructor(
        private vcr: ViewContainerRef,
        private drawerService: XaferDrawerService,
        private service: XfrNotificationsService,
    ) {
        this.topics$ = this.topicsSubj.pipe(
            scan((acc, curr) => {
                if (curr === allTopics) {
                    return new Set(allTopicsValues);
                }
                if (acc.has(curr)) {
                    acc.delete(curr)
                } else {
                    acc.add(curr);
                }
                return acc;
            }, new Set<XaferNotificationTopic>()),
            startWith(new Set<XaferNotificationTopic>(allTopicsValues)),
            shareReplay(1),
        );

        const search$ = this.searchSubj.asObservable().pipe(
            debounceTime(200),
            map(s => s.toLowerCase()),
            startWith('')
        );

        this.alarms$ = combineLatest([
            search$,
            this.service.getByStatus$(XaferNotificationState.OPEN),
            this.topics$,
        ]).pipe(
            map(([search, alarms, topics]) => {
                return alarms
                    .filter(a => a.topic && topics.has(a.topic))
                    .filter(a => !search || (a.device && a.device.name.toLowerCase().includes(search)))
            }),
            shareReplay(1)
        );

        this.alarmsCount$ = this.alarms$.pipe(map(value => value.length));
    }

    onTopicSelect(event: unknown) {
        this.topicsSubj.next(event as XaferNotificationTopic | typeof allTopics);
    }

    onSearch(event: string) {
        this.searchSubj.next(event);
    }
}
