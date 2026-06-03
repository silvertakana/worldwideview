/**
 * @file DynamicPropertiesRender.tsx
 * @description Heuristic-based property renderer that automatically detects
 * content types (images, URLs, long text) from raw entity properties.
 * @module src/components/panels/properties
 */

import React from 'react';
import { GeoEntity } from '@worldwideview/wwv-plugin-sdk';
import { ImageProperty } from './ImageProperty';
import { UrlProperty } from './UrlProperty';
import { LongTextProperty } from './LongTextProperty';
import { IntelPropertyRow } from './IntelPropertyRow';
import { DatetimePropertyRow } from "./DatetimePropertyRow";
import { VideoProperty } from "./VideoProperty";

/**
 * @interface DynamicPropertiesRenderProps
 * @description Properties for the DynamicPropertiesRender component.
 * @property {GeoEntity} entity - The entity whose properties should be rendered.
 * @property {string} [classNamePrefix] - CSS class prefix for styling (defaults to "intel-panel").
 */
interface DynamicPropertiesRenderProps {
    entity: GeoEntity;
    classNamePrefix?: string;
}

export function DynamicPropertiesRender({ entity, classNamePrefix = "intel-panel" }: DynamicPropertiesRenderProps) {
    // Filter out standard non-display properties
    const displayProps = Object.entries(entity.properties).filter(
        ([key]) => !["id", "pluginId"].includes(key)
            && entity.properties[key] !== null
            && entity.properties[key] !== undefined
    );

    return (
      <>
        {displayProps.map(([key, value]) => {
                const label = key.replace(/_/g, " ");
                const stringValue = String(value);

                // Tagged dispatch - explicit type prefix, checked before heuristics
                if (typeof value === "string") {
                    if (value.startsWith("datetime:")) {
                        return (
                            <DatetimePropertyRow
                                key={key}
                                label={label}
                                iso={value.slice(9)}
                                classNamePrefix={classNamePrefix}
                            />
                        );
                    }
                    if (value.startsWith("url:")) {
                        return (
                            <UrlProperty
                                key={key}
                                label={label}
                                url={value.slice(4)}
                                classNamePrefix={classNamePrefix}
                            />
                        );
                    }
                    if (value.startsWith("image:")) {
                        return (
                            <ImageProperty
                                key={key}
                                label={label}
                                imageUrl={value.slice(6)}
                                entityId={entity.id}
                                entityLabel={entity.label ?? ""}
                                classNamePrefix={classNamePrefix}
                            />
                        );
                    }
                    if (value.startsWith("video:")) {
                        return (
                            <VideoProperty
                                key={key}
                                label={label}
                                href={value.slice(6)}
                                classNamePrefix={classNamePrefix}
                            />
                        );
                    }
                }

                // Identify property type
                const isImage = typeof value === "string" && key.toLowerCase().includes("image") && /^https?:\/\//i.test(value);
                const isUrl = !isImage && typeof value === "string" && /^https?:\/\//i.test(value);
                const isLongText = typeof value === "string" && value.length > 20;

                if (isImage) {
                    return (
                      <ImageProperty
                        key={key}
                        label={label}
                        imageUrl={stringValue}
                        entityId={entity.id}
                        entityLabel={entity.label}
                        classNamePrefix={classNamePrefix}
                      />
                    );
                }

                if (isUrl) {
                    return (
                      <UrlProperty
                        key={key}
                        label={label}
                        url={stringValue}
                        classNamePrefix={classNamePrefix}
                      />
                    );
                }

                if (isLongText || key === "summary") {
                    return (
                      <LongTextProperty
                        key={key}
                        label={label}
                        text={stringValue}
                        classNamePrefix={classNamePrefix}
                      />
                    );
                }

                // Standard property fallback
                return (
                  <IntelPropertyRow
                    key={key}
                    label={label}
                    classNamePrefix={classNamePrefix}
                  >
                    {typeof value === "boolean" ? (value ? "Yes" : "No") : stringValue}
                  </IntelPropertyRow>
                );
            })}
      </>
    );
}
