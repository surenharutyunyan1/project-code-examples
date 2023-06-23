import { ChangeDetectionStrategy, Component, OnInit, ViewContainerRef } from "@angular/core";
import { With$Id, XaferDevice } from "@src/../../types";
import { XaferDrawerService } from "@src/app/services";
import {XfrDeviceService } from "@src/app/services/device.service";
import { combineLatest, Observable, Subject } from "rxjs";
import { debounceTime, map, scan, shareReplay, startWith, tap } from "rxjs/operators";
import { DeviceSelectEvent, WithSelected } from "../../components";
import { XfrFactoryDeviceFirmwareDialog } from "../device-firmware/factory-device-firmware.dialog";


@Component({
    templateUrl: './factory-devices.page.html',
    styleUrls: ['./factory-devices.page.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class XfrFactoryDevicesPage {

    public readonly devices$: Observable<WithSelected<With$Id<XaferDevice>>[]>;
    public readonly selectedSubj = new Subject<DeviceSelectEvent>();
    public readonly searchSubj = new Subject<string>();
    public readonly selectedIds$: Observable<Set<string>>;
    
    constructor(
        private vcr: ViewContainerRef,
        private drawerService: XaferDrawerService,
        private deviceService:XfrDeviceService,
    ) {
        this.selectedIds$ = this.selectedSubj.pipe(
            scan((acc, curr) => {
                if (curr === null) {
                    return new Set<string>();
                }
                if (!curr.selected) {
                    acc.delete(curr.deviceId)
                } else {
                    acc.add(curr.deviceId);
                }
                return acc;
            }, new Set<string>()),
            startWith(new Set<string>()),
            shareReplay(1),
        );

        const search$ = this.searchSubj.asObservable().pipe(
            debounceTime(200),
            map(s => s.toLowerCase()),
            startWith('')
        );

        this.devices$ = combineLatest([
            search$,
            this.deviceService.getDevicesInStore$(),
            this.selectedIds$
        ]).pipe(
            map(([search, devices, selectedIds]) => {
                return devices
                    .filter(d => search ? d.$id.toLowerCase().includes(search) : true)
                    .map(d => ({...d, selected: selectedIds.has(d.$id)}));
            })
        )
    }

    onDeviceSelect(event) {
        this.selectedSubj.next(event as DeviceSelectEvent);
    }

    onDeviceSearch(event) {
        this.searchSubj.next(event as string);
    }

    onFirmwareClick(devices: Set<string>) {
        const deviceIds = Array.from(devices.keys());
        const dialog = this.drawerService.openFromParent(this.vcr, XfrFactoryDeviceFirmwareDialog, deviceIds);
        dialog.onClosed.subscribe((result) => {
            if (result) {
                this.selectedSubj.next(null);
            }
        });
    }
}
