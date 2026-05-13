import React from 'react';
import { GeoEntity } from '@worldwideview/wwv-plugin-sdk';
import { ImageProperty } from './ImageProperty';
import { UrlProperty } from './UrlProperty';
import { LongTextProperty } from './LongTextProperty';
import { IntelPropertyRow } from './IntelPropertyRow';

interface DynamicPropertiesRenderProps {
    entity: GeoEntity;
    classNamePrefix?: string;
}

export function DynamicPropertiesRender({ entity, classNamePrefix = "intel-panel" }: DynamicPropertiesRenderProps) {
    // Filter out standard non-display properties
    const displayProps = Object.entries(entity.properties).filter(
        ([key]) =>
            !["id", "pluginId", "cveHeat"].includes(key) &&
            entity.properties[key] !== null &&
            entity.properties[key] !== undefined
    );

    return (
        <>
            {displayProps.map(([key, value]) => {
                const label = key.replace(/_/g, " ");
                const stringValue = String(value);
                
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
